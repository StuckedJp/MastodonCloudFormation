import {
  NatProvider,
  InstanceType,
  NatInstanceProviderV2,
  NatTrafficDirection,
  MachineImage,
} from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { ParamsType } from '../param-type';

export class NatInstanceConstruct extends Construct {
  public readonly natGatewayProvider: NatInstanceProviderV2;

  constructor(scope: Construct, params: ParamsType) {
    super(scope, 'nat-instance');

    // NatInstance
    const amiMap = new Map();
    amiMap.set(params.aws.region, params.nat.ami);
    const natGatewayProvider = NatProvider.instanceV2({
      machineImage: MachineImage.genericLinux(Object.fromEntries(amiMap)),
      instanceType: new InstanceType(params.nat.instanceType),
      defaultAllowedTraffic: NatTrafficDirection.OUTBOUND_ONLY,
      associatePublicIpAddress: true,
    });
    this.natGatewayProvider = natGatewayProvider;
  }
}
