import * as cdk from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { PublicHostedZone } from 'aws-cdk-lib/aws-route53';
import { ParameterDataType, StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export class AttachmentCertConstruct extends Construct {
  readonly attachmentCert: Certificate;
  readonly attachmentCertArnParameterName: string;

  constructor(scope: Construct, props?: cdk.StackProps) {
    super(scope, 'attachment-cert');

    const zone = PublicHostedZone.fromLookup(this, 'attachment-cert-hosted-zone', {
      domainName: process.env.ZONE_DOMAIN!,
    });

    const attachmentDistFqdn = [process.env.MASTODON_ATTACHMENT_HOST, process.env.ZONE_DOMAIN]
      .filter((v) => !!v)
      .join('.');
    this.attachmentCert = new Certificate(this, 'attachment-cert-certificate', {
      domainName: attachmentDistFqdn,
      validation: CertificateValidation.fromDns(zone),
    });

    // SSM に保存
    this.attachmentCertArnParameterName = `/mastodon/certificate_arn/attachment`;
    new StringParameter(this, 'attachment-cert-param', {
      dataType: ParameterDataType.TEXT,
      parameterName: this.attachmentCertArnParameterName,
      stringValue: this.attachmentCert.certificateArn,
    });
  }
}
