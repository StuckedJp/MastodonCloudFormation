import { Vpc, SecurityGroup, Peer, Port } from 'aws-cdk-lib/aws-ec2';
import { CfnCacheCluster, CfnSubnetGroup } from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';

export class ElasticacheStack extends Construct {
  public readonly cacheCluster: CfnCacheCluster;

  constructor(scope: Construct, vpc: Vpc) {
    super(scope, 'elasticache');

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
      subnetIds: [
        vpc.privateSubnets[0].subnetId,
        vpc.privateSubnets[1].subnetId
      ],
      description: 'mastodon-elasticache-subnet-group'
    })

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
