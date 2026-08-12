import { CfnOutput } from 'aws-cdk-lib';
import { KeyPair } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { ParamsType } from '../param-type';

export class KeyPairConstruct extends Construct {
  public readonly keyPair: KeyPair;

  constructor(scope: Construct, params: ParamsType) {
    super(scope, 'key-pair');

    this.keyPair = new KeyPair(this, 'mastodon-key-pair');
    new CfnOutput(this, 'mastodon-keypair-output', {
      key: 'getKeypairCommand',
      value: `aws ssm get-parameter --name /ec2/keypair/${this.keyPair.keyPairId} --region ${params.aws.region} --with-decryption --query Parameter.Value --output text`,
    });
  }
}
