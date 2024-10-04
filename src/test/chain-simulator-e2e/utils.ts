import axios from "axios";

const VM_TYPE = "0500";
const CODE_METADATA = "0100";
const SC_DEPLOY_ADDRESS = 'erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu';

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

    const txHash = await doContractCall(chainSimulatorUrl, deployer, SC_DEPLOY_ADDRESS, contractPayload);

    console.log(`Deployed SC. tx hash: ${txHash}`);

    const txResponse = await axios.get(`${chainSimulatorUrl}/transaction/${txHash}?withResults=true`);
    const scDeployLog = txResponse?.data?.data?.transaction?.logs?.events?.find((event: { identifier: string; }) => event.identifier === 'SCDeploy');
    return scDeployLog.address;
  } catch (e) {
    console.error(e);
    return 'n/a';
  }
}

export async function doContractCall(chainSimulatorUrl: string, caller: string, contract: string, dataField: string, gasLimit: number = 100_000_000): Promise<string> {
  try {
    const nonce = await getNonce(chainSimulatorUrl, caller);

    const tx = {
      sender: caller,
      receiver: contract,
      nonce: nonce,
      value: '0',
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
