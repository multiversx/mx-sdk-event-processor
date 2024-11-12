import axios from "axios";
import { deploySc, sendTransaction, fundAddress, issueEsdt, transferEsdt, IssueEsdtArgs, TransferEsdtArgs, DeployScArgs } from "./chain.simulator.operations";
import * as fs from "node:fs";
import { EventProcessor } from "../../src/event.processor";
import { EventProcessorOptions } from "../../src/types/event.processor.options";

const CHAIN_SIMULATOR_URL = 'http://localhost:8085';
const ELASTIC_SEARCH_URL = 'http://elasticsearch:9200';
const ALICE_ADDRESS = 'erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th';
const BOB_ADDRESS = 'erd1spyavw0956vq68xj8y4tenjpq2wd5a9p2c6j8gsz7ztyrnpxrruqzu66jx';
const CAROL_ADDRESS = 'erd1k2s324ww2g0yj38qn2ch2jwctdy8mnfxep94q9arncc6xecg3xaq6mjse8';
const ONE_EGLD = '1000000000000000000';
const VERBOSE_LOGS = false;

describe('EventProcessor e2e tests with chain simulator', () => {
  let eventProcessor: EventProcessor;

  beforeAll(async () => {
    try {
      const response = await axios.get(`${CHAIN_SIMULATOR_URL}/simulator/observers`);

      let numRetries = 0;
      while (true) {
        if (response.status === 200) {
          await axios.post(`${CHAIN_SIMULATOR_URL}/simulator/generate-blocks-until-epoch-reached/2`, {});
          break;
        }

        numRetries += 1;
        if (numRetries > 50) {
          fail("Chain simulator not started!");
        }
      }
    } catch (e) {
      console.error(e);
    }
  });

  beforeEach(() => {
    eventProcessor = new EventProcessor();
    jest.clearAllMocks();
  });

  it('should deploy a contract and receive all the ping pong events', async () => {
    const contractCodeRaw = fs.readFileSync('./e2e-tests/chain-simulator-e2e/contracts/ping-pong/ping-pong-egld.wasm');
    /*
    fn init(
        &self,
        ping_amount: &BigUint,
    ) {
     */
    const contractArgs = [
      '0de0b6b3a7640000', // 1 egld
    ];
    await fundAddress(CHAIN_SIMULATOR_URL, ALICE_ADDRESS);
    const scAddress = await deploySc(new DeployScArgs({
      chainSimulatorUrl: CHAIN_SIMULATOR_URL,
      deployer: ALICE_ADDRESS,
      contractCodeRaw: contractCodeRaw,
      hexArguments: contractArgs,
    }));
    logMessage(`Deployed ping pong SC. Address: ${scAddress}`);

    const numPingPongs = 20;

    for (let i = 0; i < numPingPongs; i++) {
      const pingTxHash = await sendTransaction({
        chainSimulatorUrl: CHAIN_SIMULATOR_URL,
        sender: ALICE_ADDRESS,
        receiver: scAddress,
        dataField: 'ping',
        value: ONE_EGLD,
        gasLimit: 20_000_000,
      });
      logMessage(`Called 'ping' function of the contract. Tx hash: ${pingTxHash}`);

      const pongTxHash = await sendTransaction({
        chainSimulatorUrl: CHAIN_SIMULATOR_URL,
        sender: ALICE_ADDRESS,
        receiver: scAddress,
        dataField: 'pong',
        value: '0',
        gasLimit: 20_000_000,
      });
      logMessage(`Called 'pong' function of the contract. Tx hash: ${pongTxHash}`);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    let numOfEventsReceived = 0;
    let lastProcessedTimestamp = 0;
    let counter = 0;
    while (true) {
      await eventProcessor.start(new EventProcessorOptions({
        emitterAddresses: [scAddress],
        eventIdentifiers: ['ping', 'pong'],
        getLastProcessedTimestamp: async () => lastProcessedTimestamp,
        elasticUrl: ELASTIC_SEARCH_URL,
        onEventsReceived: async (highestTimestamp, events) => {
          logMessage(`event processor received ${events.length} events with the highest timestamp ${highestTimestamp}`);
          numOfEventsReceived += events.length;
        },
        setLastProcessedTimestamp: async (timestamp) => {
          lastProcessedTimestamp = timestamp;
        },
        pageSize: 7,
        delayBetweenRequestsInMilliseconds: 100,
      }));

      await new Promise(resolve => setTimeout(resolve, 100));
      logMessage(`Running event processor #${counter + 1}`);

      counter++;
      if (counter > 10 || numOfEventsReceived === 2 * numPingPongs) {
        break;
      }
    }

    expect(numOfEventsReceived).toBe(numPingPongs * 2);
  }, 100000);

  it('should issue a token and event processor should receive esdt transfers', async () => {
    await fundAddress(CHAIN_SIMULATOR_URL, BOB_ADDRESS);
    const esdtIdentifier = await issueEsdt(new IssueEsdtArgs({
      chainSimulatorUrl: CHAIN_SIMULATOR_URL,
      issuer: BOB_ADDRESS,
      tokenName: 'BobToken',
      tokenTicker: 'BOB',
    }));

    const numTransfers = 20;
    for (let i = 0; i < numTransfers; i++) {
      const bobTransferTxHash = await transferEsdt(new TransferEsdtArgs({
        chainSimulatorUrl: CHAIN_SIMULATOR_URL,
        sender: BOB_ADDRESS,
        receiver: ALICE_ADDRESS,
        tokenIdentifier: esdtIdentifier,
        plainAmountOfTokens: 5,
      }));
      logMessage(`Transferred 5 tokens to Bob. Tx hash: ${bobTransferTxHash}}`);
      const carolTransferTxHash = await transferEsdt(new TransferEsdtArgs({
        chainSimulatorUrl: CHAIN_SIMULATOR_URL,
        sender: BOB_ADDRESS,
        receiver: CAROL_ADDRESS,
        tokenIdentifier: esdtIdentifier,
        plainAmountOfTokens: 5,
      }));
      logMessage(`Transferred 5 tokens to Carol. Tx hash: ${carolTransferTxHash}}`);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    let numOfEventsReceived = 0;
    let lastProcessedTimestamp = 0;
    let counter = 0;
    while (true) {
      await eventProcessor.start(new EventProcessorOptions({
        emitterAddresses: [BOB_ADDRESS],
        eventIdentifiers: ['ESDTTransfer'],
        shardId: 0, // Bob is in shard 0. esdt transfers events are emitted on both source and destination shards
        getLastProcessedTimestamp: async () => lastProcessedTimestamp,
        elasticUrl: ELASTIC_SEARCH_URL,
        onEventsReceived: async (highestTimestamp, events) => {
          logMessage(`event processor received ${events.length} events with the highest timestamp ${highestTimestamp}`);
          for (const event of events) {
            if (event && event.topics && event.topics[0] === Buffer.from(esdtIdentifier).toString('hex')) {
              numOfEventsReceived++;
            }
          }
        },
        setLastProcessedTimestamp: async (timestamp) => {
          lastProcessedTimestamp = timestamp;
        },
        pageSize: 7,
        delayBetweenRequestsInMilliseconds: 100,
      }));

      await new Promise(resolve => setTimeout(resolve, 100));
      logMessage(`Running event processor #${counter + 1}`);

      counter++;
      if (counter > 10 || numOfEventsReceived === 2 * numTransfers) {
        break;
      }
    }

    expect(numOfEventsReceived).toBe(numTransfers * 2);
  }, 100000);
});

function logMessage(message: string) {
  if (VERBOSE_LOGS) {
    console.log(message);
  }
}
