import { Vpc, SecurityGroup, Peer, Port, SubnetType, EbsDeviceVolumeType } from 'aws-cdk-lib/aws-ec2';
import { Domain, EngineVersion, IpAddressType } from 'aws-cdk-lib/aws-opensearchservice';
import { Construct } from 'constructs';
import { ParamsType } from '../param-type';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { RemovalPolicy } from 'aws-cdk-lib';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';

export class OpenSearchConstruct extends Construct {
  public readonly domain: Domain;

  constructor(scope: Construct, vpc: Vpc, params: ParamsType) {
    super(scope, 'open-search');

    if (!params.elasticSearch) {
      return;
    }

    // SecurityGroup
    const securityGroup = new SecurityGroup(this, 'mastodon-open-search-security-group', {
      vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
    });
    vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS }).subnets.forEach((subnet) => {
      securityGroup.addIngressRule(Peer.ipv4(subnet.ipv4CidrBlock), Port.tcp(443));
    });

    // ElasticSearch
    this.domain = new Domain(this, 'mastodon-open-search-domain', {
      domainName: `mastodon-open-search-${params.envName}`,
      version: EngineVersion.OPENSEARCH_3_5,
      enableVersionUpgrade: true,
      enforceHttps: true,
      nodeToNodeEncryption: true,
      encryptionAtRest: {
        enabled: true,
      },
      fineGrainedAccessControl: {
        masterUserName: params.elasticSearch.masterUserName,
      },
      ebs: {
        volumeSize: params.elasticSearch.storageGB,
        volumeType: EbsDeviceVolumeType.GP3,
      },
      vpc,
      ipAddressType: IpAddressType.DUAL_STACK,
      capacity: {
        dataNodes: 1,
        dataNodeInstanceType: params.elasticSearch.dataNodeInstanceType,
      },
      securityGroups: [securityGroup],
      vpcSubnets: [{ subnets: [vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS }).subnets[0]] }],
      logging: {
        slowSearchLogEnabled: true,
        slowSearchLogGroup: new LogGroup(this, 'mastodon-open-search-domain-slow-search-log', {
          logGroupName: params.elasticSearch.logGroupName.slowSearch,
          removalPolicy: RemovalPolicy.DESTROY,
          retention: RetentionDays.ONE_YEAR,
        }),
        appLogEnabled: true,
        appLogGroup: new LogGroup(this, 'mastodon-open-search-domain-app-log', {
          logGroupName: params.elasticSearch.logGroupName.app,
          removalPolicy: RemovalPolicy.DESTROY,
          retention: RetentionDays.ONE_YEAR,
        }),
        slowIndexLogEnabled: true,
        slowIndexLogGroup: new LogGroup(this, 'mastodon-open-search-domain-slow-index-log', {
          logGroupName: params.elasticSearch.logGroupName.slowIndex,
          removalPolicy: RemovalPolicy.DESTROY,
          retention: RetentionDays.ONE_YEAR,
        }),
      },
    });

    params.elasticSearch.packages.forEach((packageId) => {
      new AwsCustomResource(this, 'mastodon-open-search-domain-package-associate', {
        onCreate: {
          service: 'OpenSearch',
          action: 'associatePackage',
          parameters: {
            PackageID: packageId,
            DomainName: this.domain.domainName,
          },
          physicalResourceId: PhysicalResourceId.of(`opensearch-plugin-${packageId}`),
        },
        policy: AwsCustomResourcePolicy.fromSdkCalls({
          resources: AwsCustomResourcePolicy.ANY_RESOURCE,
        }),
      });
    });
  }
}
