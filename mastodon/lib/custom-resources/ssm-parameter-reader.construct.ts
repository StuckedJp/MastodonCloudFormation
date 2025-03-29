import * as cdk from 'aws-cdk-lib';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

export interface SsmParameterReaderCustomResourceProps extends cdk.StackProps {
  parameterName: string;
  region: string;
}

export class SsmParameterReaderCustomResource extends Construct {
  readonly customResource: AwsCustomResource;

  constructor(scope: Construct, id: string, props: SsmParameterReaderCustomResourceProps) {
    super(scope, id);

    this.customResource = new AwsCustomResource(this, `${id}-ssm-parameter-reader-custom-resource`, {
      policy: AwsCustomResourcePolicy.fromStatements([
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['ssm:GetParameter*'],
          resources: [
            cdk.Stack.of(this).formatArn({
              service: 'ssm',
              region: props.region,
              resource: 'parameter',
              resourceName: props.parameterName.replace(/^\/+/, ''),
            }),
          ],
        }),
      ]),
      onUpdate: {
        service: 'SSM',
        action: 'getParameter',
        parameters: {
          Name: props.parameterName,
        },
        region: props.region,
        physicalResourceId: PhysicalResourceId.of(Date.now().toString()),
      },
    });
  }

  get stringValue(): string {
    return this.customResource.getResponseField('Parameter.Value');
  }
}
