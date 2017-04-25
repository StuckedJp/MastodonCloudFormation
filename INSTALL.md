# AWS インストール手順

https://github.com/tootsuite/documentation/blob/master/Running-Mastodon/Production-guide.md

## パッケージのインストール

```
sudo apt-get install -y imagemagick ffmpeg libpq-dev libxml2-dev libxslt1-dev nodejs file git curl gcc g++ ruby ruby-dev make postgresql-client

curl -sL https://deb.nodesource.com/setup_4.x | sudo bash -

sudo apt-get install -y nodejs

sudo npm install -g yarn
```

## psql で接続を確認

```
psql -h [RDS HOST] -p [PORT] -d [DB NAME] -U [USER NAME]
```


## mastodon ユーザーを作成

```
sudo adduser mastodon
sudo su - mastodon
```

## ビルド

```
git clone https://github.com/tootsuite/mastodon.git live
cd live
git checkout $(git tag | tail -n 1)

sudo gem install bundler
bundle install --deployment --without development test
yarn install --pure-lockfile

```


## 設定


```
cp .env.production.sample .env.production
vi .env.production
```

```
REDIS_HOST=[ELASTICASHE HOST]
REDIS_PORT=6379

DB_HOST=[RDS HOST]
DB_USER=mastodon
DB_NAME=mastodon
DB_PASS=
DB_PORT=5432

LOCAL_DOMAIN=mastodon.stsf.tokyo
LOCAL_HTTPS=false
```

## セットアップ

```
rake secret

vim

config.secret_key = '[SECRET]'


RAILS_ENV=production bundle exec rails db:setup
RAILS_ENV=production bundle exec rails assets:precompile

```


## systemd 設定

/etc/systemd/system/mastodon-web.service

```
[Unit]
Description=mastodon-web
After=network.target

[Service]
Type=simple
User=mastodon
WorkingDirectory=/home/mastodon/live
Environment="RAILS_ENV=production"
Environment="PORT=3000"
Environment="SECRET_KEY_BASE=[SECRET]"
ExecStart=/usr/local/bin/bundle exec puma -C config/puma.rb
TimeoutSec=15
Restart=always

[Install]
WantedBy=multi-user.target
```


/etc/systemd/system/mastodon-sidekiq.service

```
[Unit]
Description=mastodon-sidekiq
After=network.target

[Service]
Type=simple
User=mastodon
WorkingDirectory=/home/mastodon/live
Environment="RAILS_ENV=production"
Environment="DB_POOL=5"
ExecStart=/usr/local/bin/bundle exec sidekiq -c 5 -q default -q mailers -q pull -q push
TimeoutSec=15
Restart=always

[Install]
WantedBy=multi-user.target
```

/etc/systemd/system/mastodon-streaming.service

```
[Unit]
Description=mastodon-streaming
After=network.target

[Service]
Type=simple
User=mastodon
WorkingDirectory=/home/mastodon/live
Environment="NODE_ENV=production"
Environment="PORT=4000"
ExecStart=/usr/bin/npm run start
TimeoutSec=15
Restart=always

[Install]
WantedBy=multi-user.target
```

```
sudo systemctl enable /etc/systemd/system/mastodon-*.service
sudo systemctl start mastodon-web.service mastodon-sidekiq.service mastodon-streaming.service
```