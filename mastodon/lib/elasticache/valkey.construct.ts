import { Vpc, SecurityGroup, Peer, Port, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { CfnParameterGroup, CfnReplicationGroup, CfnSubnetGroup } from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';
import { ParamsType } from '../param-type';

export class ValkeyConstruct extends Construct {
  public readonly replicationGroup: CfnReplicationGroup;

  constructor(scope: Construct, vpc: Vpc, params: ParamsType) {
    super(scope, 'valkey');

    // SecurityGroup
    const securityGroup = new SecurityGroup(this, 'mastodon-valkey-security-group', {
      vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
    });
    vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS }).subnets.forEach((subnet) => {
      securityGroup.addIngressRule(Peer.ipv4(subnet.ipv4CidrBlock), Port.tcp(6379));
    });

    // SubnetGroup
    const subnetGroup = new CfnSubnetGroup(this, 'mastodon-valkey-subnet-group', {
      subnetIds: vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS }).subnetIds,
      description: 'mastodon-valkey-subnet-group',
    });

    this.replicationGroup = new CfnReplicationGroup(this, 'mastodon-valkey-replication-group', {
      replicationGroupDescription: 'mastodon-valkey-replication-group',
      engine: 'valkey',
      engineVersion: '7.2',
      cacheNodeType: 'cache.t3.micro',
      cacheSubnetGroupName: subnetGroup.ref,
      cacheParameterGroupName: new CfnParameterGroup(this, 'mastodon-valkey-parameter-group', {
        description: 'mastodon-valkey-replication-group',
        cacheParameterGroupFamily: 'valkey7',
      }).ref,
      clusterMode: 'disabled',
      numCacheClusters: 1,
      automaticFailoverEnabled: false,
      securityGroupIds: [securityGroup.securityGroupId],
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
      transitEncryptionMode: 'preferred',
    });
  }
}
