import { Vpc, SecurityGroup, Peer, Port, SubnetType, EbsDeviceVolumeType } from 'aws-cdk-lib/aws-ec2';
import { Domain, EngineVersion, IpAddressType } from 'aws-cdk-lib/aws-opensearchservice';
import { Construct } from 'constructs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { ParamsType } from '../param-type';
import { Effect, PolicyStatement, StarPrincipal } from 'aws-cdk-lib/aws-iam';

export class OpenSearchConstruct extends Construct {
  public readonly domain: Domain;

  constructor(scope: Construct, vpc: Vpc, params: ParamsType) {
    super(scope, 'opensearch');

    if (!params.elasticSearch) {
      return;
    }

    // SecurityGroup
    const securityGroup = new SecurityGroup(this, 'mastodon-opensearch-security-group', {
      vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
    });
    vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS }).subnets.forEach((subnet) => {
      securityGroup.addIngressRule(Peer.ipv4(subnet.ipv4CidrBlock), Port.tcp(443));
    });

    // ElasticSearch
    this.domain = new Domain(this, 'mastodon-opensearch-domain', {
      domainName: `mastodon-opensearch-${params.envName}`,
      version: EngineVersion.OPENSEARCH_3_7,
      enableVersionUpgrade: true,
      enforceHttps: true,
      nodeToNodeEncryption: true,
      encryptionAtRest: {
        enabled: true,
      },
      accessPolicies: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['es:*'],
          principals: [new StarPrincipal()],
          resources: [
            Stack.of(this).formatArn({
              region: params.aws.region,
              service: 'es',
              resource: 'domain',
              resourceName: `mastodon-opensearch-${params.envName}/*`,
            }),
          ],
        }),
      ],
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
      removalPolicy: RemovalPolicy.DESTROY,
      logging: {
        slowSearchLogEnabled: true,
        slowSearchLogGroup: new LogGroup(this, 'mastodon-opensearch-domain-slow-search-log', {
          logGroupName: params.elasticSearch.logGroupName.slowSearch,
          removalPolicy: RemovalPolicy.DESTROY,
          retention: RetentionDays.ONE_YEAR,
        }),
        appLogEnabled: true,
        appLogGroup: new LogGroup(this, 'mastodon-opensearch-domain-app-log', {
          logGroupName: params.elasticSearch.logGroupName.app,
          removalPolicy: RemovalPolicy.DESTROY,
          retention: RetentionDays.ONE_YEAR,
        }),
        slowIndexLogEnabled: true,
        slowIndexLogGroup: new LogGroup(this, 'mastodon-opensearch-domain-slow-index-log', {
          logGroupName: params.elasticSearch.logGroupName.slowIndex,
          removalPolicy: RemovalPolicy.DESTROY,
          retention: RetentionDays.ONE_YEAR,
        }),
      },
    });

    params.elasticSearch.packages.forEach((packageId) => {
      new AwsCustomResource(this, 'mastodon-opensearch-domain-package-associate', {
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
