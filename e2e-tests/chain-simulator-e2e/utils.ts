import axios from "axios";

const VM_TYPE = "0500";
const CODE_METADATA = "0100";
const SC_DEPLOY_ADDRESS = 'erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu';
const ESDT_ADDRESS = 'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzllls8a5w6u';

export async function fundAddress(chainSimulatorUrl: string, address: string) {
  const payload = [
    {
      address: address,
      balance: '100000000000000000000000',
    },
  ];
  await axios.post(`${chainSimulatorUrl}/simulator/set-state`, payload);
}

export async function getNonce(chainSimulatorUrl: string, address: string): Promise<number> {
  try {
    const currentNonceResponse = await axios.get(`${chainSimulatorUrl}/address/${address}/nonce`);
    return currentNonceResponse.data.data.nonce;
  } catch (e) {
    console.error(e);
    return 0;
  }
}

export async function deploySc(
  chainSimulatorUrl: string,
  deployer: string,
  contractCodeRaw: Buffer,
  hexArguments: string[],
): Promise<string> {
  try {
    const nonce = await getNonce(chainSimulatorUrl, deployer);

    const contractCodeHex = Buffer.from(contractCodeRaw).toString('hex');
    const contractArgs = [VM_TYPE, CODE_METADATA, ...hexArguments];
    const contractPayload = contractCodeHex + '@' + contractArgs.join('@');

    const txHash = await sendTransaction(chainSimulatorUrl, deployer, SC_DEPLOY_ADDRESS, contractPayload);

    const txResponse = await axios.get(`${chainSimulatorUrl}/transaction/${txHash}?withResults=true`);
    const scDeployLog = txResponse?.data?.data?.transaction?.logs?.events?.find((event: { identifier: string; }) => event.identifier === 'SCDeploy');
    console.log(`Deployed SC. tx hash: ${txHash}. address: ${scDeployLog?.address}`);
    return scDeployLog?.address;
  } catch (e) {
    console.error(e);
    return 'n/a';
  }
}

export async function issueEsdt(chainSimulatorUrl: string, sender: string, tokenName: string, tokenTicker: string) {
  const txHash = await sendTransaction(
    chainSimulatorUrl,
    sender,
    ESDT_ADDRESS,
    `issue@${Buffer.from(tokenName).toString('hex')}@${Buffer.from(tokenTicker).toString('hex')}@1e9b0e04e39e5845000000@12`,
    '50000000000000000');

  const txResponse = await axios.get(`${chainSimulatorUrl}/transaction/${txHash}?withResults=true`);
  const esdtIssueLog = txResponse?.data?.data?.transaction?.logs?.events?.find((event: { identifier: string; }) => event.identifier === 'issue');
  const tokenIdentifier = Buffer.from(esdtIssueLog.topics[0], 'base64').toString();
  console.log(`Issued token with ticker ${tokenTicker}. tx hash: ${txHash}. identifier: ${tokenIdentifier}`);
  return tokenIdentifier;
}

export async function transferEsdt(chainSimulatorUrl: string, sender: string, receiver: string, tokenIdentifier: string, plainAmountOfTokens: number) {
  const transferValue = plainAmountOfTokens * (10 ** 18);
  const txHash = await sendTransaction(
    chainSimulatorUrl,
    sender,
    receiver,
    `ESDTTransfer@${Buffer.from(tokenIdentifier).toString('hex')}@${transferValue.toString(16)}`,
    '0');
  return txHash;
}

export async function sendTransaction(chainSimulatorUrl: string, sender: string, receiver: string, dataField: string, value: string = '0', gasLimit: number = 100_000_000): Promise<string> {
  try {
    const nonce = await getNonce(chainSimulatorUrl, sender);

    const tx = {
      sender: sender,
      receiver: receiver,
      nonce: nonce,
      value: value,
      gasPrice: 1000000000,
      gasLimit: gasLimit,
      data: Buffer.from(dataField).toString('base64'),
      signature: 'a'.repeat(128),
      chainID: 'chain',
      version: 1,
    };

    const txHashResponse = await axios.post(`${chainSimulatorUrl}/transaction/send`, tx);
    const txHash = txHashResponse.data.data.txHash;
    await axios.post(`${chainSimulatorUrl}/simulator/generate-blocks-until-transaction-processed/${txHash}`);
    return txHash;
  } catch (e) {
    console.error(e);
    return 'n/a';
  }
}
