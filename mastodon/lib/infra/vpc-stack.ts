import { aws_ec2 } from 'aws-cdk-lib';
import { NatInstanceProvider, SubnetType, GatewayVpcEndpointAwsService, CfnVPCCidrBlock } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { Ipv6Subnet } from './ipv6-subnet';

export class VpcStack extends Construct {
  public readonly vpc: aws_ec2.Vpc;

  constructor(scope: Construct, natGatewayProvider: NatInstanceProvider) {
    super(scope, 'vpc');

    const vpc = new aws_ec2.Vpc(this, 'mastodon-infra-vpc', {
      ipAddresses: aws_ec2.IpAddresses.cidr(process.env.VPC_CIDR!),
      vpcName: 'mastodon-infra-vpc',
      natGatewayProvider,
      natGateways: 1,
      maxAzs: 2,
      subnetConfiguration: [
        {
          subnetType: SubnetType.PUBLIC,
          name: 'Ingress',
          cidrMask: 24,
        },
        {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
          name: 'Application',
          cidrMask: 24,
        },
      ],
      gatewayEndpoints: {
        S3: {
          service: GatewayVpcEndpointAwsService.S3,
        },
      },
    });

    // IPv6
    new Ipv6Subnet(this, 'mastodon-infra-vpc-ipv6', { vpc });

    this.vpc = vpc;
  }
}
