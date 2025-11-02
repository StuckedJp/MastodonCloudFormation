#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MastodonInfraStack } from '../lib/infra/mastodon-infra-stack';
import { MastodonRdsStack } from '../lib/rds/mastodon-rds-stack';
import { MastodonElasticacheStack } from '../lib/elasticache/mastodon-elasticache-stack';
import { MastodonBastionStack } from '../lib/bastion/mastodon-bastion-stack';
import { MastodonAppStack } from '../lib/app/mastodon-app-stack';
import { MastodonRoute53Stack } from '../lib/route53/mastodon-route53-stack';
import { GlobalCertStack } from '../lib/certs/global-cert.stack';
import { RegionalCertStack } from '../lib/certs/regional-cert.stack';
import { ParamsType } from '../lib/param-type';

const envName = process.env.ENV_NAME ?? 'dev';
const parameterFile = `${__dirname}/../params.${envName}.json`;
const params = require(parameterFile) as ParamsType;

const config = {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: params.aws.region },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
};

const app = new cdk.App();

// Route53
new MastodonRoute53Stack(app, `MastodonRoute53Stack-${params.envName}`, config, params);

// Certificates
const globalCertStack = new GlobalCertStack(
  app,
  `MastodonGlobalCertStack-${params.envName}`,
  {
    ...config,
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
  },
  params,
);
const regionalCertStack = new RegionalCertStack(app, `MastodonRegionalCertStack-${params.envName}`, config, params);

// VPC, S3, NAT, AttachmentDistribution
const infraStack = new MastodonInfraStack(
  app,
  `MastodonInfraStack-${params.envName}`,
  {
    ...config,
    attachmentCertArnParamName: globalCertStack.attachmentCert.attachmentCertArnParameterName,
  },
  params,
);

// RDS
const rdsStack = new MastodonRdsStack(
  app,
  `MastodonRdsStack-${params.envName}`,
  {
    ...config,
    vpcIdParameterName: infraStack.vpc.vpcIdParameterName,
  },
  params,
);

// Elasticache
const elasticacheStack = new MastodonElasticacheStack(
  app,
  `MastodonElasticacheStack-${params.envName}`,
  {
    ...config,
    vpcIdParameterName: infraStack.vpc.vpcIdParameterName,
  },
  params,
);

// 踏み台
const bastionStack = new MastodonBastionStack(
  app,
  `MastodonBastionStack-${params.envName}`,
  {
    ...config,
    vpc: infraStack.vpc.vpc,
    contentBucket: infraStack.s3.contents,
    backyardBucket: infraStack.s3.backyard,
    dbSecrets: rdsStack.rds.secret,
    keyPair: infraStack.keyPair.keyPair,
    cache: {
      endpointAddress: elasticacheStack.valkey.replicationGroup.attrPrimaryEndPointAddress,
      endpointPort: elasticacheStack.valkey.replicationGroup.attrPrimaryEndPointPort,
    },
  },
  params,
);

// アプリ
const appStack = new MastodonAppStack(
  app,
  `MastodonAppStack-${params.envName}`,
  {
    ...config,
    vpc: infraStack.vpc.vpc,
    backyard: infraStack.s3.backyard,
    contents: infraStack.s3.contents,
    accessLog: infraStack.s3.accessLog,
    keyPair: infraStack.keyPair.keyPair,
    globalCertArnParamName: globalCertStack.appCert.appCertArnParameterName,
    regionalCertArnParamName: regionalCertStack.appCert?.appCertArnParameterName,
  },
  params,
);
