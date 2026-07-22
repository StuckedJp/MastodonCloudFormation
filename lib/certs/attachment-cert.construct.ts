import * as cdk from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { PublicHostedZone } from 'aws-cdk-lib/aws-route53';
import { ParameterDataType, StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ParamsType } from '../param-type';

export class AttachmentCertConstruct extends Construct {
  readonly attachmentCert: Certificate;
  readonly attachmentCertArnParameterName: string;

  constructor(scope: Construct, props: cdk.StackProps, params: ParamsType) {
    super(scope, 'attachment-cert');

    const zone = PublicHostedZone.fromLookup(this, 'attachment-cert-hosted-zone', {
      domainName: params.domain.name,
    });

    const attachmentDistFqdn = [params.domain.attachmentHost, params.domain.name]
      .filter((v) => !!v)
      .join('.');
    this.attachmentCert = new Certificate(this, 'attachment-cert-certificate', {
      certificateName: `attachment-certificate-${params.envName}`,
      domainName: attachmentDistFqdn,
      validation: CertificateValidation.fromDns(zone),
    });

    // SSM に保存
    this.attachmentCertArnParameterName = `/mastodon/${props.env?.region}/${params.envName}/certificate_arn/attachment`;
    new StringParameter(this, 'attachment-cert-param', {
      dataType: ParameterDataType.TEXT,
      parameterName: this.attachmentCertArnParameterName,
      stringValue: this.attachmentCert.certificateArn,
    });
  }
}
