import { RemovalPolicy } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class S3Stack extends Construct {
  public readonly backyard: Bucket;
  public readonly accessLog: Bucket;
  public readonly contents: Bucket;

  constructor(scope: Construct) {
    super(scope, 's3');

    // S3
    this.backyard = new Bucket(this, 'mastodon-infra-s3-backyard', {
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.accessLog = new Bucket(this, 'mastodon-infra-s3-access-log', {
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.contents = new Bucket(this, 'mastodon-infra-s3-contents', {
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
