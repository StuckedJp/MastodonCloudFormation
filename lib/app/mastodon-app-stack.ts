import * as cdk from 'aws-cdk-lib';
import { KeyPair, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { ApplicationLoadBalancerConstruct } from './alb.construct';
import { AppConstruct } from './app.construct';
import { ApplicationDistributionConstruct } from './app-dist.construct';
import { ParamsType } from '../param-type';

export interface AppStackProps extends cdk.StackProps {
  vpc: Vpc;
  contents: Bucket;
  backyard: Bucket;
  accessLog: Bucket;
  keyPair: KeyPair;
  globalCertArnParamName: string;
  regionalCertArnParamName: string;
}

export class MastodonAppStack extends cdk.Stack {
  public readonly app: AppConstruct;
  public readonly applicationLoadBalancer: ApplicationLoadBalancerConstruct;
  public readonly applicationDistribution: ApplicationDistributionConstruct;

  constructor(scope: Construct, id: string, props: AppStackProps, params: ParamsType) {
    super(scope, id, props);

    this.app = new AppConstruct(this, props.vpc, props.contents, props.backyard, props.keyPair, params);
    this.applicationLoadBalancer = new ApplicationLoadBalancerConstruct(
      this,
      props.vpc,
      this.app.autoScalingGroup,
      props.regionalCertArnParamName ? props.regionalCertArnParamName : props.globalCertArnParamName,
      params,
    );
    this.applicationDistribution = new ApplicationDistributionConstruct(
      this,
      this.applicationLoadBalancer.applicationLoadBalancer,
      props.accessLog,
      props.globalCertArnParamName,
      params,
    );
  }
}
