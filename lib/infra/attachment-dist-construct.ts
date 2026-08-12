import { Construct } from 'constructs';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { AaaaRecord, ARecord, ARecordProps, PublicHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { SsmParameterReaderCustomResource } from '../custom-resources/ssm-parameter-reader.construct';
import { ParamsType } from '../param-type';

export class AttachmentDistributionConstruct extends Construct {
  public readonly distribution: Distribution;

  constructor(scope: Construct, bucket: Bucket, certArnParamName: string, params: ParamsType) {
    super(scope, 'attachment-distribution');

    const fqdn = [params.domain.attachmentHost, params.domain.name].filter((v) => !!v).join('.');
    const certArnReader = new SsmParameterReaderCustomResource(this, 'attachment-distribution-cert-arn-reader', {
      parameterName: certArnParamName,
      region: 'us-east-1',
    });
    const certificate = Certificate.fromCertificateArn(
      this,
      'cloud-front-attachment-distribution-acm',
      certArnReader.stringValue,
    );

    // Distribution
    this.distribution = new Distribution(this, 'attachment-distribution-cloud-front', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
      },
      defaultRootObject: 'nothing',
      domainNames: [fqdn],
      certificate,
    });

    // DNS Records
    const zone = PublicHostedZone.fromLookup(this, 'attachment-distribution-hosted-zone', {
      domainName: params.domain.name,
    });
    const aRecordProp: ARecordProps = {
      recordName: params.domain.attachmentHost,
      zone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
    };
    new ARecord(this, 'attachment-distribution-a-record', aRecordProp);
    new AaaaRecord(this, 'attachment-distribution-aaaa-record', aRecordProp);
  }
}
