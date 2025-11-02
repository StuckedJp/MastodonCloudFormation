import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { S3Construct } from './s3.construct';
import { VpcConstruct } from './vpc.construct';
import { NatInstanceConstruct } from './nat-instance.construct';
import { AttachmentDistributionConstruct } from './attachment-dist-construct';
import { KeyPairConstruct } from './key-pair.construct';
import { ParamsType } from '../param-type';

export interface InfraStackProps extends cdk.StackProps {
  attachmentCertArnParamName: string;
}

export class MastodonInfraStack extends cdk.Stack {
  public readonly nat: NatInstanceConstruct;
  public readonly keyPair: KeyPairConstruct;
  public readonly vpc: VpcConstruct;
  public readonly s3: S3Construct;
  public readonly attachmentDistribution: AttachmentDistributionConstruct;

  constructor(scope: Construct, id: string, props: InfraStackProps, params: ParamsType) {
    super(scope, id, props);

    this.nat = new NatInstanceConstruct(this, params);
    this.keyPair = new KeyPairConstruct(this, params);
    this.vpc = new VpcConstruct(this, this.nat.natGatewayProvider, params);
    this.s3 = new S3Construct(this, params);
    this.attachmentDistribution = new AttachmentDistributionConstruct(
      this,
      this.s3.contents,
      props.attachmentCertArnParamName,
      params,
    );
  }
}
