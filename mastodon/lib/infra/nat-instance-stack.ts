import { NatProvider, InstanceType, NatInstanceProvider } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class NatInstanceStack extends Construct {
  public readonly natGatewayProvider: NatInstanceProvider;

  constructor(scope: Construct) {
    super(scope, 'nat-instance');

    // NatInstance
    const natGatewayProvider = NatProvider.instance({
      instanceType: new InstanceType(process.env.NAT_INSTANCE_TYPE!),
    });
    this.natGatewayProvider = natGatewayProvider;
  }
}
