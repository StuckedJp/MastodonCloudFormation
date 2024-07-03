import { aws_ec2 } from 'aws-cdk-lib';
import { SubnetType, GatewayVpcEndpointAwsService, NatInstanceProviderV2 } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class VpcStack extends Construct {
  public readonly vpc: aws_ec2.Vpc;

  constructor(scope: Construct, natGatewayProvider: NatInstanceProviderV2) {
    super(scope, 'vpc');

    const vpc = new aws_ec2.Vpc(this, 'mastodon-infra-vpc', {
      ipAddresses: aws_ec2.IpAddresses.cidr(process.env.VPC_CIDR!),
      vpcName: 'mastodon-infra-vpc',
      natGatewayProvider,
      natGateways: 1,
      maxAzs: 2,
      ipProtocol: aws_ec2.IpProtocol.DUAL_STACK,
      subnetConfiguration: [
        {
          subnetType: SubnetType.PUBLIC,
          name: 'Ingress',
          cidrMask: 24,
          ipv6AssignAddressOnCreation: true,
        },
        {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
          name: 'Application',
          cidrMask: 24,
          ipv6AssignAddressOnCreation: true,
        },
      ],
      gatewayEndpoints: {
        S3: {
          service: GatewayVpcEndpointAwsService.S3,
        },
      },
    });

    this.vpc = vpc;
  }
}
