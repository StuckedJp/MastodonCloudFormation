import {
  SubnetType,
  GatewayVpcEndpointAwsService,
  NatInstanceProviderV2,
  Port,
  Peer,
  Vpc,
  IpAddresses,
  IpProtocol,
  InterfaceVpcEndpointAwsService,
} from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { ParamsType } from '../param-type';

export class VpcConstruct extends Construct {
  public readonly vpc: Vpc;

  constructor(scope: Construct, natGatewayProvider: NatInstanceProviderV2, params: ParamsType) {
    super(scope, 'vpc');

    const vpc = new Vpc(this, 'mastodon-infra-vpc', {
      ipAddresses: IpAddresses.cidr(params.vpc.cidr),
      vpcName: `mastodon-infra-vpc-${params.envName}`,
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
          mapPublicIpOnLaunch: false,
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

    vpc.addInterfaceEndpoint('mastodon-infra-vpc-endpoint-ssm', { service: InterfaceVpcEndpointAwsService.SSM });
    vpc.addInterfaceEndpoint('mastodon-infra-vpc-endpoint-ssm-messages', {
      service: InterfaceVpcEndpointAwsService.SSM_MESSAGES,
    });
    vpc.addInterfaceEndpoint('mastodon-infra-vpc-endpoint-ec2', { service: InterfaceVpcEndpointAwsService.EC2 });
    vpc.addInterfaceEndpoint('mastodon-infra-vpc-endpoint-ec2-messages', {
      service: InterfaceVpcEndpointAwsService.EC2_MESSAGES,
    });

    natGatewayProvider.securityGroup.addIngressRule(Peer.ipv4(vpc.vpcCidrBlock), Port.allTraffic());

    this.vpc = vpc;
  }
}
