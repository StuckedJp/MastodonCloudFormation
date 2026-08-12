import { RemovalPolicy } from 'aws-cdk-lib';
import { BlockPublicAccess, Bucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { ParamsType } from '../param-type';

export class S3Construct extends Construct {
  public readonly backyard: Bucket;
  public readonly accessLog: Bucket;
  public readonly contents: Bucket;

  constructor(scope: Construct, params: ParamsType) {
    super(scope, 's3');

    // S3
    this.backyard = new Bucket(this, 'mastodon-infra-s3-backyard', {
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      bucketName: params.s3.bucket.backyard,
    });

    this.accessLog = new Bucket(this, 'mastodon-infra-s3-access-log', {
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
      bucketName: params.s3.bucket.log,
    });

    this.contents = new Bucket(this, 'mastodon-infra-s3-contents', {
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: new BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      objectOwnership: ObjectOwnership.OBJECT_WRITER,
      bucketName: params.s3.bucket.contents,
    });
  }
}
