import {
  SubnetType,
  GatewayVpcEndpointAwsService,
  NatInstanceProviderV2,
  Port,
  Peer,
  Vpc,
  IpAddresses,
  IpProtocol,
  SecurityGroup,
  InterfaceVpcEndpoint,
  InterfaceVpcEndpointAwsService,
} from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class VpcStack extends Construct {
  public readonly vpc: Vpc;

  constructor(scope: Construct, natGatewayProvider: NatInstanceProviderV2) {
    super(scope, 'vpc');

    const vpc = new Vpc(this, 'mastodon-infra-vpc', {
      ipAddresses: IpAddresses.cidr(process.env.VPC_CIDR!),
      vpcName: 'mastodon-infra-vpc',
      enableDnsSupport: true,
      enableDnsHostnames: true,
      natGatewayProvider,
      natGateways: 1,
      maxAzs: 2,
      ipProtocol: IpProtocol.DUAL_STACK,
      subnetConfiguration: [
        {
          subnetType: SubnetType.PUBLIC,
          name: 'Ingress',
          cidrMask: 24,
          ipv6AssignAddressOnCreation: true,
          mapPublicIpOnLaunch: true,
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

    natGatewayProvider.securityGroup.addIngressRule(Peer.ipv4(vpc.vpcCidrBlock), Port.allTraffic());

    this.vpc = vpc;
  }
}
