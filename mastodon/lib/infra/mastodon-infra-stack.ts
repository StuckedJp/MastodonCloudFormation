import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { S3Construct } from './s3.construct';
import { VpcConstruct } from './vpc.construct';
import { NatInstanceConstruct } from './nat-instance.construct';
import { CloudFrontConstruct } from './cloud-front.construct';

export class MastodonInfraStack extends cdk.Stack {
  public readonly natGatewayProvider: NatInstanceConstruct;
  public readonly vpc: VpcConstruct;
  public readonly s3: S3Construct;
  public readonly cloudFront: CloudFrontConstruct;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.natGatewayProvider = new NatInstanceConstruct(this);
    this.vpc = new VpcConstruct(this, this.natGatewayProvider.natGatewayProvider);
    this.s3 = new S3Construct(this);
    this.cloudFront = new CloudFrontConstruct(this, this.s3.contents)
  }
}
