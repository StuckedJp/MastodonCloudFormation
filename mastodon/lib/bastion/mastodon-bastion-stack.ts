import * as cdk from 'aws-cdk-lib';
import { KeyPair, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { BastionConstruct } from './bastion.construct';
import { ParamsType } from '../param-type';
import { Domain } from 'aws-cdk-lib/aws-opensearchservice';

export interface BastionStackProps extends cdk.StackProps {
  vpc: Vpc;
  contentBucket: Bucket;
  backyardBucket: Bucket;
  dbSecrets: ISecret;
  keyPair: KeyPair;
  cache: {
    endpointAddress: string;
    endpointPort: string;
  };
  elasticSearch?: {
    domain: Domain;
  };
}

export class MastodonBastionStack extends cdk.Stack {
  public readonly bastion: BastionConstruct;

  constructor(scope: Construct, id: string, props: BastionStackProps, params: ParamsType) {
    super(scope, id, props);

    this.bastion = new BastionConstruct(this, props, params);
  }
}
