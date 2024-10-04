import axios from "axios";
import { deploySc, doContractCall, fundAddress } from "./utils";
import * as fs from "node:fs";
import { EventProcessor } from "../../event.processor";
import { EventProcessorOptions } from "../../types/event.processor.options";

const CHAIN_SIMULATOR_URL = 'http://127.0.0.1:8085';
const ALICE_ADDRESS = 'erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th';

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

  it('should deploy the contract and receive all the events', async () => {
    const contractCodeRaw = fs.readFileSync('./src/test/chain-simulator-e2e/contracts/ping-pong/ping-pong-egld.wasm');
    /*
    fn init(
        &self,
        ping_amount: &BigUint,
        duration_in_seconds: u64,
        opt_activation_timestamp: Option<u64>,
        max_funds: OptionalValue<BigUint>,
    ) {
     */
    const contractArgs = [
      '00',
      '0186a0',
      '00',
      '00',
    ];
    await fundAddress(CHAIN_SIMULATOR_URL, ALICE_ADDRESS);
    const scAddress = await deploySc(CHAIN_SIMULATOR_URL, ALICE_ADDRESS, contractCodeRaw, contractArgs);
    console.log(`Deployed ping pong SC. Address: ${scAddress}`);

    for (let i = 0; i < 10; i++) {
      const pingTxHash = await doContractCall(CHAIN_SIMULATOR_URL, ALICE_ADDRESS, scAddress, 'ping', 20_000_000);
      console.log(`Called 'ping' function of the contract. Tx hash: ${pingTxHash}`);

      const pongTxHash = await doContractCall(CHAIN_SIMULATOR_URL, ALICE_ADDRESS, scAddress, 'pong', 20_000_000);
      console.log(`Called 'pong' function of the contract. Tx hash: ${pongTxHash}`);
    }

    let numOfEventsReceived = 0;
    let lastProcessedTimestamp = 0;
    await eventProcessor.start(new EventProcessorOptions({
      emitterAddresses: [scAddress],
      getLastProcessedTimestamp: async () => lastProcessedTimestamp,
      elasticUrl: 'http://127.0.0.1:9200',
      onEventsReceived: async () => {
        numOfEventsReceived++;
      },
      setLastProcessedTimestamp: async (timestamp) => {
        lastProcessedTimestamp = timestamp;
      },
      pageSize: 10,
      delayBetweenRequestsInMilliseconds: 1000,
    }));

    expect(numOfEventsReceived).toBeGreaterThan(1);
  }, 100000);
});
