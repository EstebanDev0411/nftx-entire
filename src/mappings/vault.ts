import {
  Transfer as TransferEvent,
  Minted as MintEvent,
  Swapped as SwapEvent,
  Redeemed as RedeemEvent,
  ManagerSet as ManagerSetEvent,
  EnableMintUpdated as EnableMintUpdatedEvent,
  EnableRandomRedeemUpdated as EnableRandomRedeemUpdatedEvent,
  EnableTargetRedeemUpdated as EnableTargetRedeemUpdatedEvent,
  EnableSwapUpdated as EnableSwapUpdatedEvent,
  MintFeeUpdated as MintFeeUpdatedEvent,
  RandomRedeemFeeUpdated as RandomRedeemFeeUpdatedEvent,
  TargetRedeemFeeUpdated as TargetRedeemFeeUpdatedEvent,
} from '../types/templates/NFTXVaultUpgradeable/NFTXVaultUpgradeable';
import {
  getGlobal,
  getSwap,
  getVault,
  getFeeReceipt,
  getMint,
  getUser,
  getRedeem,
  updateManager,
  getFeature,
  getFee,
  getToken,
  addToHoldings,
  removeFromHoldings,
  getVaultDayData,
  getVaultHourData,
} from './helpers';
import { BigInt, ethereum, dataSource } from '@graphprotocol/graph-ts';
import { ADDRESS_ZERO } from './constants';
import { SECS_PER_DAY, SECS_PER_HOUR, getDay, getHour } from './datetime';

export function handleTransfer(event: TransferEvent): void {
  let global = getGlobal();
  let vaultAddress = event.address;
  if (
    event.params.from == ADDRESS_ZERO &&
    event.params.to == global.feeDistributorAddress
  ) {
    let feeReceipt = getFeeReceipt(event.transaction.hash);
    feeReceipt.vault = vaultAddress.toHexString();
    feeReceipt.token = vaultAddress.toHexString();
    feeReceipt.amount = event.params.value;
    feeReceipt.date = event.block.timestamp;
    feeReceipt.save();

    let vault = getVault(vaultAddress);
    vault.totalFees = vault.totalFees.plus(event.params.value);
    vault.save();
  }

  let token = getToken(vaultAddress);
  token.save();
}

export function handleMint(event: MintEvent): void {
  let vaultAddress = event.address;

  let txHash = event.transaction.hash;
  let mint = getMint(txHash);
  let user = getUser(event.params.to);
  mint.user = user.id;
  mint.vault = vaultAddress.toHexString();
  mint.date = event.block.timestamp;
  mint.nftIds = event.params.nftIds;
  mint.amounts = event.params.amounts;

  let feeReceipt = getFeeReceipt(event.transaction.hash);
  feeReceipt.vault = vaultAddress.toHexString();
  feeReceipt.token = vaultAddress.toHexString();
  feeReceipt.date = event.block.timestamp;
  feeReceipt.save();
  mint.feeReceipt = feeReceipt.id;

  mint.save();
  user.save();

  let added = addToHoldings(
    vaultAddress,
    event.params.nftIds,
    event.params.amounts,
  );

  let token = getToken(vaultAddress);
  token.save();

  let vault = getVault(vaultAddress);
  vault.totalMints = vault.totalMints.plus(BigInt.fromI32(1));
  vault.totalHoldings = vault.totalHoldings.plus(added);
  vault.save();

  let global = getGlobal();
  global.totalHoldings = global.totalHoldings.plus(added);
  global.save();
}

export function handleSwap(event: SwapEvent): void {
  let vaultAddress = event.address;

  let txHash = event.transaction.hash;
  let swap = getSwap(txHash);
  let nftIds = event.params.nftIds;
  let amounts = event.params.amounts;
  let specificIds = event.params.specificIds;
  let redeemedIds = event.params.redeemedIds;
  let user = getUser(event.params.to);

  swap.user = user.id;
  swap.vault = vaultAddress.toHexString();
  swap.date = event.block.timestamp;
  swap.mintedIds = nftIds;
  swap.mintedAmounts = amounts;
  swap.redeemedIds = redeemedIds;
  swap.specificIds = specificIds;
  swap.targetCount = BigInt.fromI32(specificIds.length);
  swap.randomCount = BigInt.fromI32(nftIds.length - specificIds.length);

  let feeReceipt = getFeeReceipt(event.transaction.hash);
  feeReceipt.vault = vaultAddress.toHexString();
  feeReceipt.token = vaultAddress.toHexString();
  feeReceipt.date = event.block.timestamp;
  feeReceipt.save();
  swap.feeReceipt = feeReceipt.id;

  swap.save();
  user.save();

  let added = addToHoldings(vaultAddress, nftIds, amounts);
  let removed = removeFromHoldings(vaultAddress, redeemedIds);

  let token = getToken(vaultAddress);
  token.save();

  let vault = getVault(vaultAddress);
  vault.totalSwaps = vault.totalRedeems.plus(BigInt.fromI32(1));
  vault.totalHoldings = vault.totalHoldings.plus(added).minus(removed);
  vault.save();

  let global = getGlobal();
  global.totalHoldings = global.totalHoldings.plus(added).minus(removed);
  global.save();
}

export function handleRedeem(event: RedeemEvent): void {
  let vaultAddress = event.address;

  let txHash = event.transaction.hash;
  let redeem = getRedeem(txHash);
  let nftIds = event.params.nftIds;
  let specificIds = event.params.specificIds;
  let user = getUser(event.params.to);

  redeem.user = user.id;
  redeem.vault = vaultAddress.toHexString();
  redeem.date = event.block.timestamp;
  redeem.nftIds = nftIds;
  redeem.specificIds = specificIds;
  redeem.targetCount = BigInt.fromI32(specificIds.length);
  redeem.randomCount = BigInt.fromI32(nftIds.length - specificIds.length);

  let feeReceipt = getFeeReceipt(event.transaction.hash);
  feeReceipt.vault = vaultAddress.toHexString();
  feeReceipt.token = vaultAddress.toHexString();
  feeReceipt.date = event.block.timestamp;
  feeReceipt.save();
  redeem.feeReceipt = feeReceipt.id;

  redeem.save();
  user.save();

  let removed = removeFromHoldings(vaultAddress, event.params.nftIds);

  let token = getToken(vaultAddress);
  token.save();

  let vault = getVault(vaultAddress);
  vault.totalRedeems = vault.totalRedeems.plus(BigInt.fromI32(1));
  vault.totalHoldings = vault.totalHoldings.minus(removed);
  vault.save();

  let global = getGlobal();
  global.totalHoldings = global.totalHoldings.minus(removed);
  global.save();
}

export function handleManagerSet(event: ManagerSetEvent): void {
  let managerAddress = event.params.manager;
  let vault = getVault(event.address);
  vault = updateManager(vault, managerAddress);
  vault.save();
}

export function handleEnableMintUpdated(event: EnableMintUpdatedEvent): void {
  let features = getFeature(event.address);
  features.enableMint = event.params.enabled;
  features.save();
}

export function handleEnableRandomRedeemUpdated(
  event: EnableRandomRedeemUpdatedEvent,
): void {
  let features = getFeature(event.address);
  features.enableRandomRedeem = event.params.enabled;
  features.save();
}

export function handleEnableTargetRedeemUpdated(
  event: EnableTargetRedeemUpdatedEvent,
): void {
  let features = getFeature(event.address);
  features.enableTargetRedeem = event.params.enabled;
  features.save();
}

export function handleEnableSwapUpdated(event: EnableSwapUpdatedEvent): void {
  let features = getFeature(event.address);
  features.enableSwap = event.params.enabled;
  features.save();
}

export function handleMintFeeUpdated(event: MintFeeUpdatedEvent): void {
  let fees = getFee(event.address);
  fees.mintFee = event.params.mintFee;
  fees.save();
}

export function handleRandomRedeemFeeUpdated(
  event: RandomRedeemFeeUpdatedEvent,
): void {
  let fees = getFee(event.address);
  fees.randomRedeemFee = event.params.randomRedeemFee;
  fees.save();
}

export function handleTargetRedeemFeeUpdated(
  event: TargetRedeemFeeUpdatedEvent,
): void {
  let fees = getFee(event.address);
  fees.targetRedeemFee = event.params.targetRedeemFee;
  fees.save();
}

var ONE_DAY = BigInt.fromI32(SECS_PER_DAY);
var ONE_HOUR = BigInt.fromI32(SECS_PER_HOUR);

export function handleBlock(block: ethereum.Block): void {
  let timestamp = block.timestamp;
  let vaultAddress = dataSource.address();
  let vault = getVault(vaultAddress);
  let vaultCreatedAt = vault.createdAt;
  if (vaultCreatedAt.gt(BigInt.fromI32(0))) {
    let lastDay = getDay(timestamp);
    let lastDayData = getVaultDayData(vaultAddress, lastDay);
    let day = lastDay.plus(ONE_DAY);
    let vaultDayData = getVaultDayData(vaultAddress, day);
    vaultDayData.mintsCount = vault.totalMints.minus(lastDayData.totalMints);
    vaultDayData.redeemsCount = vault.totalRedeems.minus(
      lastDayData.totalRedeems,
    );
    vaultDayData.holdingsCount = vault.totalHoldings.minus(
      lastDayData.totalHoldings,
    );
    vaultDayData.totalMints = vault.totalMints;
    vaultDayData.totalRedeems = vault.totalRedeems;
    vaultDayData.totalHoldings = vault.totalHoldings;
    vaultDayData.save();

    let lastHour = getHour(timestamp);
    let lastHourData = getVaultHourData(vaultAddress, lastHour);
    let hour = lastHour.plus(ONE_HOUR);
    let vaultHourData = getVaultHourData(vaultAddress, hour);
    vaultHourData.mintsCount = vault.totalMints.minus(lastHourData.totalMints);
    vaultHourData.redeemsCount = vault.totalRedeems.minus(
      lastHourData.totalRedeems,
    );
    vaultHourData.holdingsCount = vault.totalHoldings.minus(
      lastHourData.totalHoldings,
    );
    vaultHourData.totalMints = vault.totalMints;
    vaultHourData.totalRedeems = vault.totalRedeems;
    vaultHourData.totalHoldings = vault.totalHoldings;
    vaultHourData.save();
  }
}
