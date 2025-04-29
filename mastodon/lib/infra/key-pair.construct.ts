import { CfnOutput } from 'aws-cdk-lib';
import { KeyPair } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class KeyPairConstruct extends Construct {
  public readonly keyPair: KeyPair;

  constructor(scope: Construct) {
    super(scope, 'key-pair');

    this.keyPair = new KeyPair(this, 'mastodon-key-pair');
    new CfnOutput(this, 'mastodon-bastion-instance-keypair-output', {
      key: 'getKeypairCommand',
      value: `aws ssm get-parameter --name /ec2/keypair/${this.keyPair.keyPairId} --region ${process.env.CDK_DEFAULT_REGION} --with-decryption --query Parameter.Value --output text`,
    });
  }
}
