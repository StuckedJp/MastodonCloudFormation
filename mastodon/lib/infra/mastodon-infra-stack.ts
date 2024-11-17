import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { S3Stack } from './s3-stack';
import { VpcStack } from './vpc-stack';
import { NatInstanceStack } from './nat-instance-stack';
import { CloudFrontStack } from './cloud-front-stack';

export class MastodonInfraStack extends cdk.Stack {
  public readonly natGatewayProvider: NatInstanceStack;
  public readonly vpc: VpcStack;
  public readonly s3: S3Stack;
  public readonly cloudFront: CloudFrontStack;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.natGatewayProvider = new NatInstanceStack(this);
    this.vpc = new VpcStack(this, this.natGatewayProvider.natGatewayProvider);
    this.s3 = new S3Stack(this);
    this.cloudFront = new CloudFrontStack(this, this.s3.contents)
  }
}
