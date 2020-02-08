const Web3 = require('web3');
const solc = require('solc');
const fs = require('fs');
const path = require('path');
const blcPath = process.env.BLC_PATH;
const blcName = process.env.BLC_NAME;
const rpc = process.env.RPC;
const gas = 6000000;
const contractUrl = './node_modules/kovan-validator-set/contracts';
const web3 = new Web3(rpc);
const key = fs.readFileSync(`${blcPath}/data/keys/${blcName}/key`).toString();
const pwds = fs.readFileSync(`${blcPath}/node.pwds`).toString();
const pwd = pwds.split('\n')[0];
const account = web3.eth.accounts.decrypt(key, pwd);

web3.eth.accounts.wallet.add(account);
const options = {
  from: web3.eth.accounts.wallet[0].address,
  defaultAccount: web3.eth.accounts.wallet[0].address,
  defaultGasPrice: '0'
};

const relaySetInput = {
  language: 'Solidity',
  sources: {
    'RelaySet.sol': {
      content: fs.readFileSync(`${contractUrl}/RelaySet.sol`).toString()
    }
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['*']
      }
    }
  }
};

const relayedOwnedSetInput = {
  language: 'Solidity',
  sources: {
    'RelayedOwnedSet.sol': {
      content: fs.readFileSync(`${contractUrl}/RelayedOwnedSet.sol`).toString()
    }
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['*']
      }
    }
  }
};

function findImports(location) {
  return {
    contents: fs.readFileSync(path.resolve(contractUrl, location)).toString()
  };
}

const compiledRelaySet = JSON.parse(
  solc.compile(JSON.stringify(relaySetInput), {
    import: findImports
  })
);
const compiledRelayedOwnedSet = JSON.parse(
  solc.compile(JSON.stringify(relayedOwnedSetInput), {
    import: findImports
  })
);

const relaySetAbi = compiledRelaySet.contracts['RelaySet.sol'].RelaySet.abi;
const relayedOwnedSetAbi =
  compiledRelayedOwnedSet.contracts['RelayedOwnedSet.sol'].RelayedOwnedSet.abi;

const relaySetBytecode =
  compiledRelaySet.contracts['RelaySet.sol'].RelaySet.evm.bytecode.object;
const relayedOwnedSetBytecode =
  compiledRelayedOwnedSet.contracts['RelayedOwnedSet.sol'].RelayedOwnedSet.evm
    .bytecode.object;

const relaySet = new web3.eth.Contract(relaySetAbi, options);
const relayedOwnedSet = new web3.eth.Contract(relayedOwnedSetAbi, options);

depoloyContracts();

async function depoloyContracts() {
  const relaySetInstance = await relaySet
    .deploy({ data: `0x${relaySetBytecode}` })
    .send({ gas });
  const relaysetAddress = relaySetInstance.options.address;
  const relayedOwnedSetInstance = await relayedOwnedSet
    .deploy({
      data: `0x${relayedOwnedSetBytecode}`,
      arguments: [relaysetAddress, [account.address]]
    })
    .send({ gas });
  const relayedOwnedSetAddress = relayedOwnedSetInstance.options.address;
  const owner = await relaySetInstance.methods.owner().call();
  await relaySetInstance.methods
    .setRelayed(relayedOwnedSetAddress)
    .send({ gas });
  const validators = await relaySetInstance.methods.getValidators().call();
}
