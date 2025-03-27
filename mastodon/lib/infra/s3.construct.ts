import { RemovalPolicy } from 'aws-cdk-lib';
import { AccountPrincipal, AccountRootPrincipal, ArnPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket, CfnBucketPolicy } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class S3Construct extends Construct {
  public readonly backyard: Bucket;
  public readonly accessLog: Bucket;
  public readonly contents: Bucket;

  constructor(scope: Construct) {
    super(scope, 's3');

    // S3
    this.backyard = new Bucket(this, 'mastodon-infra-s3-backyard', {
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    this.accessLog = new Bucket(this, 'mastodon-infra-s3-access-log', {
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });
    this.accessLog.addToResourcePolicy(
      new PolicyStatement({
        actions: ['s3:PutObject'],
        effect: Effect.ALLOW,
        principals: [new AccountPrincipal('127311923021')],
        resources: [this.accessLog.arnForObjects('*')],
      }),
    );

    this.contents = new Bucket(this, 'mastodon-infra-s3-contents', {
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
