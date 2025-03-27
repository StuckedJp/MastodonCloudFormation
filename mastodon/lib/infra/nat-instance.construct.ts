import { NatProvider, InstanceType, NatInstanceProviderV2, NatTrafficDirection } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class NatInstanceConstruct extends Construct {
  public readonly natGatewayProvider: NatInstanceProviderV2;

  constructor(scope: Construct) {
    super(scope, 'nat-instance');

    // NatInstance
    const natGatewayProvider = NatProvider.instanceV2({
      instanceType: new InstanceType(process.env.NAT_INSTANCE_TYPE!),
      defaultAllowedTraffic: NatTrafficDirection.OUTBOUND_ONLY,
      associatePublicIpAddress: true,
    });
    this.natGatewayProvider = natGatewayProvider;
  }
}
