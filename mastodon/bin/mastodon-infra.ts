#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MastodonInfraStack } from '../lib/infra/mastodon-infra-stack';
import { MastodonRdsStack } from '../lib/rds/mastodon-rds-stack';
import { MastodonElasticacheStack } from '../lib/elasticache/mastodon-elasticache-stack';
import { MastodonBastionStack } from '../lib/bastion/mastodon-bastion-stack';
import { MastodonAppStack } from '../lib/app/mastodon-app-stack';

require('dotenv').config();

const config = {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  env: { account: process.env.AWS_ACCOUNT, region: process.env.AWS_REGION },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
};

const app = new cdk.App();
const infraStack = new MastodonInfraStack(app, 'MastodonInfraStack', config);
const rdsStack = new MastodonRdsStack(app, 'MastodonRdsStack', { ...config, vpc: infraStack.vpc.vpc });
const elasticacheStack = new MastodonElasticacheStack(app, 'MastodonElasticacheStack', {
  ...config,
  vpc: infraStack.vpc.vpc,
});
const bastionStack = new MastodonBastionStack(app, 'MastodonBastionStack', {
  ...config,
  vpc: infraStack.vpc.vpc,
  backyard: infraStack.s3.backyard,
  contents: infraStack.s3.contents,
  dbSecrets: rdsStack.rds.secret,
  dbInstance: rdsStack.rds.databaseInstance,
  cacheCluster: elasticacheStack.elasticache.cacheCluster,
});
const appStack = new MastodonAppStack(app, 'MastodonAppStack', {
  ...config,
  vpc: infraStack.vpc.vpc,
  backyard: infraStack.s3.backyard,
  contents: infraStack.s3.contents,
  accessLog: infraStack.s3.accessLog,
  dbSecrets: rdsStack.rds.secret,
  cacheCluster: elasticacheStack.elasticache.cacheCluster,
});
