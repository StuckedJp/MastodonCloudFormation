import * as cdk from 'aws-cdk-lib';
import { KeyPair, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { BastionConstruct } from './bastion.construct';

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
}

export class MastodonBastionStack extends cdk.Stack {
  public readonly bastion: BastionConstruct;

  constructor(scope: Construct, id: string, props: BastionStackProps) {
    super(scope, id, props);

    this.bastion = new BastionConstruct(
      this,
      props,
    );
  }
}
