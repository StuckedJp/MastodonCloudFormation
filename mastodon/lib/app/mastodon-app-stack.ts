import * as cdk from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { CfnCacheCluster } from 'aws-cdk-lib/aws-elasticache';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { ApplicationLoadBalancerConstruct } from './alb.construct';
import { AppConstruct } from './app.construct';

export interface AppStackProps extends cdk.StackProps {
  vpc: Vpc;
  contents: Bucket;
  backyard: Bucket;
  accessLog: Bucket;
  dbSecrets: Secret;
  cacheCluster: CfnCacheCluster;
}

export class MastodonAppStack extends cdk.Stack {
  public readonly app: AppConstruct;
  public readonly applicationLoadBalancer: ApplicationLoadBalancerConstruct;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    this.app = new AppConstruct(this, props.vpc, props.contents, props.backyard, props.dbSecrets, props.cacheCluster);
    this.applicationLoadBalancer = new ApplicationLoadBalancerConstruct(
      this,
      props.vpc,
      this.app.autoScalingGroup,
      props.accessLog,
    );
  }
}
