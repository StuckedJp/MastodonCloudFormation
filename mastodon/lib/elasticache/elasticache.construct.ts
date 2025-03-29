import { Vpc, SecurityGroup, Peer, Port, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { CfnCacheCluster, CfnSubnetGroup } from 'aws-cdk-lib/aws-elasticache';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export class ElasticacheConstruct extends Construct {
  public readonly cacheCluster: CfnCacheCluster;

  constructor(scope: Construct, vpcIdParameterName: string) {
    super(scope, 'elasticache');

    const vpc = Vpc.fromLookup(this, 'mastodon-elasticache-vpc', {
      vpcId: StringParameter.valueFromLookup(this, vpcIdParameterName),
    });

    // SecurityGroup
    const securityGroup = new SecurityGroup(this, 'mastodon-elasticache-security-group', {
      vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
    });
    securityGroup.addIngressRule(Peer.ipv4(vpc.privateSubnets[0].ipv4CidrBlock), Port.tcp(6379));
    securityGroup.addIngressRule(Peer.ipv4(vpc.privateSubnets[1].ipv4CidrBlock), Port.tcp(6379));
    securityGroup.addIngressRule(Peer.ipv4(vpc.publicSubnets[0].ipv4CidrBlock), Port.tcp(6379));
    securityGroup.addIngressRule(Peer.ipv4(vpc.publicSubnets[1].ipv4CidrBlock), Port.tcp(6379));

    // SubnetGroup
    const subnetGroup = new CfnSubnetGroup(this, 'mastodon-elasticache-subnet-group', {
      subnetIds: vpc.selectSubnets({subnetType: SubnetType.PRIVATE_WITH_EGRESS}).subnetIds,
      description: 'mastodon-elasticache-subnet-group',
    });

    // Using the templated secret as credentials
    this.cacheCluster = new CfnCacheCluster(this, 'mastodon-elasticache-cluster', {
      vpcSecurityGroupIds: [securityGroup.securityGroupId],
      cacheSubnetGroupName: subnetGroup.ref,
      cacheNodeType: 'cache.t2.micro',
      engine: 'redis',
      engineVersion: '7.1',
      numCacheNodes: 1,
      autoMinorVersionUpgrade: true,
      clusterName: 'mastodon-elasticache-cluster',
    });
  }
}
