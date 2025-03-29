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
import { ParameterDataType, StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export class VpcConstruct extends Construct {
  public readonly vpc: Vpc;
  public readonly vpcIdParameterName: string;

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

    natGatewayProvider.securityGroup.addIngressRule(Peer.ipv4(vpc.vpcCidrBlock), Port.allTraffic());

    // SSM に保存
    this.vpcIdParameterName = `/mastodon/vpcId`;
    new StringParameter(this, 'mastodon-infra-vpc-param', {
      dataType: ParameterDataType.TEXT,
      parameterName: this.vpcIdParameterName,
      stringValue: vpc.vpcId,
    });

    this.vpc = vpc;
  }
}
