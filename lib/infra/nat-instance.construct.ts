import { NatProvider, InstanceType, NatInstanceProviderV2, NatTrafficDirection } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { ParamsType } from '../param-type';

export class NatInstanceConstruct extends Construct {
  public readonly natGatewayProvider: NatInstanceProviderV2;

  constructor(scope: Construct, params: ParamsType) {
    super(scope, 'nat-instance');

    // NatInstance
    const natGatewayProvider = NatProvider.instanceV2({
      instanceType: new InstanceType(params.nat.instanceType),
      defaultAllowedTraffic: NatTrafficDirection.OUTBOUND_ONLY,
      associatePublicIpAddress: true,
    });
    this.natGatewayProvider = natGatewayProvider;
  }
}
