import { dataSource, BigInt, Address } from '@graphprotocol/graph-ts';
import { Global, Asset, Token, Manager } from '../types/schema';
import { ERC20Metadata } from '../types/NFTXVaultFactoryUpgradeable/ERC20Metadata';
import { ERC677Metadata } from '../types/NFTXVaultFactoryUpgradeable/ERC677Metadata';

export function getGlobal(): Global {
  let global_id = dataSource.network();
  let global = Global.load(global_id);
  if (global == null) {
    global = new Global(global_id);
    global.totalHoldings = BigInt.fromI32(0);
  }
  return global as Global;
}

export function getAsset(assetAddress: Address): Asset {
  let asset = Asset.load(assetAddress.toHexString());
  if (asset == null) {
    asset = new Asset(assetAddress.toHexString());
    let erc677 = ERC677Metadata.bind(assetAddress);
    asset.name = erc677.name();
    asset.symbol = erc677.symbol();
    asset.vaults = new Array<string>();
  }
  return asset as Asset;
}

export function getToken(tokenAddress: Address): Token {
  let token = Token.load(tokenAddress.toHexString());
  if (token == null) {
    token = new Token(tokenAddress.toHexString());
    let erc20 = ERC20Metadata.bind(tokenAddress);
    token.name = erc20.name();
    token.symbol = erc20.symbol();
    token.totalSupply = erc20.totalSupply();
  }
  return token as Token;
}

export function getManager(managerAddress: Address): Manager {
  let manager = Manager.load(managerAddress.toHexString());
  if (manager == null) {
    manager = new Manager(managerAddress.toHexString());
    manager.vaults = new Array<string>();
  }
  return manager as Manager;
}
