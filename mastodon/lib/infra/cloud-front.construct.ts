import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class CloudFrontConstruct extends Construct {
  public readonly distribution: Distribution;

  constructor(scope: Construct, bucket: Bucket) {
    super(scope, 'cloud-front');

    // SecurityGroup
    this.distribution = new Distribution(this, 'cloud-front-attachment-distribution', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
      },
      defaultRootObject: '',
      domainNames: [process.env.MASTODON_ATTACHMENT_FQDN!],
      certificate: Certificate.fromCertificateArn(
        this,
        'cloud-front-attachment-distribution-acm',
        process.env.MASTODON_ATTACHMENT_CERTIFICATE_ARN!,
      ),
    });
  }
}
