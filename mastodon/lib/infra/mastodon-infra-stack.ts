import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { S3Stack } from './s3-stack';
import { VpcStack } from './vpc-stack';
import { NatInstanceStack } from './nat-instance-stack';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class MastodonInfraStack extends cdk.Stack {
  public readonly natGatewayProvider: NatInstanceStack;
  public readonly vpc: VpcStack;
  public readonly s3: S3Stack;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'MastodonInfraQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
    this.natGatewayProvider = new NatInstanceStack(this);
    this.vpc = new VpcStack(this, this.natGatewayProvider.natGatewayProvider);
    this.s3 = new S3Stack(this);
  }
}
