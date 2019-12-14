# Chef で Web サービスを立てる

Chef の応用編として、Web サービスを立ててみる。本記事では Webサービスとして Mastodon を選択する。Mastodon は Twitter のようなマイクロブロギングサービスで、比較的簡単に立ち上げられる。公式ドキュメントがあるのでこれを読みつつ Chef の Cookbook を書いていく。
https://docs.joinmastodon.org/administration/installation/

## 何をするか

以下の作業を自動化する。

* Linux ユーザーの作成
* Rbenv を使って Ruby on Rails アプリをデプロイ。
* Ruby on Rails アプリを Systemd に登録する。
* Nginx でリバースプロキシを立てる。
* PostgreSQL のセットアップ(ユーザー作成)。


## 構成

1. Vagrant で2つの仮想マシンを立てる。
    * workstation
        * chef をインストールする
    * node
        * mastodon を立てるサーバー
    ```
    Vagrant.configure("2") do |config|

        if Vagrant.has_plugin?("vagrant-proxyconf")
            config.proxy.http     = "http://10.0.2.2:3128/"
            config.proxy.https    = "http://10.0.2.2:3128/"
            config.proxy.no_proxy = "localhost,127.0.0.1,10.0.2.2"
        end

        # Workstation
        config.vm.define "workstation" do |atomic|
            atomic.vm.box = "ubuntu/bionic64"
            atomic.vm.hostname = "workstation"
            atomic.vm.network :forwarded_port, id: "ssh", guest: 22, host: 2201
            atomic.vm.network "private_network", ip: "192.168.100.10", virtualbox__intnet: "intra"
            atomic.vm.provider "virtualbox" do |vb|
              vb.memory = "2048"
            end
            atomic.vm.provision "shell", inline: <<-SHELL
              apt update
              apt upgrade -y
            SHELL
            atomic.vm.provision "chef_solo" do |chef|
              chef.version = "14.12.9"
              chef.add_recipe "chefdk"
            end
        end

        # Node
        config.vm.define "node" do |atomic|
            atomic.vm.box = "ubuntu/bionic64"
            atomic.vm.hostname = "node"
            atomic.vm.network :forwarded_port, id: "ssh", guest: 22, host: 2202
            atomic.vm.network :forwarded_port, id: "http", guest: 80, host: 8001
            atomic.vm.network "private_network", ip: "192.168.100.11", virtualbox__intnet: "intra"
            atomic.vm.provider "virtualbox" do |vb|
            vb.memory = "2048"
            end
            atomic.vm.provision "shell", inline: <<-SHELL
                apt update
                apt upgrade -y
            SHELL
        end
    end
    ```
1. 仮想マシンを立てる
    ```
    vagrant up
    ```
1. workstation にログインする。
    ```
    vagrant ssh workstation
    ```
1. node の秘密鍵を workstation にコピーする。
    ```
    cd /vagrant
    cp .vagrant/machines/node/virtualbox/private_key ~/.ssh/id_rsa_node
    chmod 600 ~/.ssh/id_rsa_node
    ```


## Chef Zero のインストール

1. `vagrant ssh workstation` で workstation にログインし、以下を実行する。
    ```
    chef gem install knife-zero
    chef gem install knife-zero -v 1.19.6  # Chefdk 1.6.11
    ```

## リポジトリの作成

1. `chef generate repo chef-repo`
1. chef-repo/conf.rb を作成
    ```ruby
    ssl_verify_mode  :verify_peer
    chef_zero.enabled true
    local_mode true
    knife[:listen] = true
    ```

## Node の登録

1. Node を登録する。
    ```
    knife zero bootstrap 192.168.100.11 -U vagrant -i ~/.ssh/id_rsa_node --sudo --bootstrap-proxy http://10.0.2.2:3128 --bootstrap-no-proxy 127.0.0.1
    ```
1. Node の登録を確認する。
    ```
    knife node -c conf.rb list

    ...

    node
    ```
1. /etc/hosts に node を登録する。
    ```
    192.168.100.11  node    node
    ```


## Cookbook の作成

パッケージインストールの Cookbook を作成する。

1. `cd chef-repo/cookbooks`
1. `chef generate cookbook pkg_install`

### Recipe の作成

1. `cd pkg_install/recipes`
1. default.rb を編集する。



### Node に Recipe を定義する

```
knife node -c conf.rb run_list add node 'recipe[pkg_install]'
```

### Node に Recipe を適用する

```
knife zero -c conf.rb converge 'name:node' -U vagrant --sudo -i ~/.ssh/id_rsa_node
```


## ユーザー追加

1. `cd chef-repo/cookbooks`
1. `chef generate cookbook add_user`
1. `cd ..`
1. `knife data bag -c conf.rb create user mastodon --disable-editing`
1. `knife node -c conf.rb run_list add node 'recipe[add_user]'`
1. `knife zero -c conf.rb converge 'name:node' -U vagrant --sudo -i ~/.ssh/id_rsa_node`


## rbenv を mastodon ユーザーにインストール

1. `cd chef-repo/cookbooks`
1. `chef generate cookbook install_rbenv`
1. `knife node -c conf.rb run_list add node 'recipe[install_rbenv]'`
1. `knife zero -c conf.rb converge 'name:node' -U vagrant --sudo -i ~/.ssh/id_rsa_node`


## データベースを設定

1. `cd chef-repo/cookbooks`
1. `chef generate cookbook setup_database`
1. `cd ..`
1. `knife data bag -c conf.rb create server mastodon --disable-editing`
1. `knife node -c conf.rb run_list add node 'recipe[setup_database]'`
1. `knife zero -c conf.rb converge 'name:node' -U vagrant --sudo -i ~/.ssh/id_rsa_node`


## Mastodon をインストール

1. `cd chef-repo/cookbooks`
1. `chef generate cookbook setup_mastodon`
1. `cd ..`
1. `knife node -c conf.rb run_list add node 'recipe[setup_mastodon]'`
1. `knife zero -c conf.rb converge 'name:node' -U vagrant --sudo -i ~/.ssh/id_rsa_node`


## nginx の設定

1. `cd chef-repo/cookbooks`
1. `chef generate cookbook setup_nginx`
1. `cd ..`
1. `knife node -c conf.rb run_list add node 'recipe[setup_nginx]'`
1. `knife zero -c conf.rb converge 'name:node' -U vagrant --sudo -i ~/.ssh/id_rsa_node`


## Mastodon サービスの設定

1. `cd chef-repo/cookbooks`
1. `chef generate cookbook setup_mastodon_service`
1. `cd ..`
1. `knife node -c conf.rb run_list add node 'recipe[setup_mastodon_service]'`
1. `knife zero -c conf.rb converge 'name:node' -U vagrant --sudo -i ~/.ssh/id_rsa_node`



## 接続!

http://localhost:8001/about/ に繋いでみます。



## 仮想マシンを作り直した場合

```
chef gem install knife-zero

knife zero bootstrap 192.168.100.11 -U vagrant -i ~/.ssh/id_rsa_node --sudo --bootstrap-proxy http://10.0.2.2:3128 --bootstrap-no-proxy 127.0.0.1
knife node -c conf.rb list

knife node -c conf.rb run_list add node 'recipe[pkg_install]'
knife node -c conf.rb run_list add node 'recipe[add_user]'
knife node -c conf.rb run_list add node 'recipe[install_rbenv]'
knife node -c conf.rb run_list add node 'recipe[setup_database]'
knife node -c conf.rb run_list add node 'recipe[setup_mastodon]'
knife node -c conf.rb run_list add node 'recipe[setup_nginx]'
knife node -c conf.rb run_list add node 'recipe[setup_mastodon_service]'

knife zero -c conf.rb converge 'name:node' -U vagrant --sudo -i ~/.ssh/id_rsa_node
```