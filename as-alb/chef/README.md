# Mastodon Chef


## Chef Zero のインストール

1. https://downloads.chef.io/chefdk から ChefDK をダウンロードしてインストールする。
1. コマンドプロンプトを開いて、以下を実行。
    ```
    chef gem install knife-zero
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


## Cookbook の作成

パッケージインストールの Cookbook を作成する。

1. `cd chef-repo/cookbooks`
1. `chef generate cookbook pkg_install`

## Recipe の作成

1. `cd pkg_install/recipes`
1. default.rb を編集する。

## Node の登録

1. 仮想マシンの IP アドレスを取得する。今回の場合 192.168.100.10 がIPアドレスとなる
1. Node を登録する。
    ```
    knife zero bootstrap 192.168.100.10 -U vagrant -i ../.vagrant/machines/default/virtualbox/private_key --sudo --bootstrap-proxy http://10.0.2.2:3128 --bootstrap-no-proxy 127.0.0.1
    ```
1. Node の登録を確認する。
    ```
    knife node -c conf.rb list

    ...

    ubuntu-bionic
    ```



## Node に Recipe を定義する

```
knife node -c conf.rb run_list add ubuntu-bionic 'recipe[pkg_install]'
```

## Node に Recipe を適用する

```
knife zero -c conf.rb converge 'name:ubuntu-bionic' -U vagrant --sudo -i ../.vagrant/machines/default/virtualbox/private_key
```


## ユーザー追加

1. `cd chef-repo/cookbooks`
1. `chef generate cookbook add_user`
1. `cd ..`
1. `knife data bag -c conf.rb create user mastodon --disable-editing`
1. `knife node -c conf.rb run_list add ubuntu-bionic 'recipe[add_user]'`
1. `knife zero -c conf.rb converge 'name:ubuntu-bionic' -U vagrant --sudo -i ../.vagrant/machines/default/virtualbox/private_key`


## rbenv を mastodon ユーザーにインストール

1. `cd chef-repo/cookbooks`
1. `chef generate cookbook install_rbenv`
1. `knife node -c conf.rb run_list add ubuntu-bionic 'recipe[install_rbenv]'`
1. `knife zero -c conf.rb converge 'name:ubuntu-bionic' -U vagrant --sudo -i ../.vagrant/machines/default/virtualbox/private_key`


## mastodon をインストール

1. `cd chef-repo/cookbooks`
1. `chef generate cookbook setup_mastodon`
1. `cd ..`
1. `knife data bag -c conf.rb create server mastodon --disable-editing`
1. `knife node -c conf.rb run_list add ubuntu-bionic 'recipe[setup_mastodon]'`
1. `knife zero -c conf.rb converge 'name:ubuntu-bionic' -U vagrant --sudo -i ../.vagrant/machines/default/virtualbox/private_key`


## nginx の設定

1. `cd chef-repo/cookbooks`
1. `chef generate cookbook setup_nginx`
1. `cd ..`
1. `knife node -c conf.rb run_list add ubuntu-bionic 'recipe[setup_nginx]'`
1. `knife zero -c conf.rb converge 'name:ubuntu-bionic' -U vagrant --sudo -i ../.vagrant/machines/default/virtualbox/private_key`


## mastodon サービスの設定

1. `cd chef-repo/cookbooks`
1. `chef generate cookbook setup_mastodon_service`
1. `cd ..`
1. `knife node -c conf.rb run_list add ubuntu-bionic 'recipe[setup_mastodon_service]'`
1. `knife zero -c conf.rb converge 'name:ubuntu-bionic' -U vagrant --sudo -i ../.vagrant/machines/default/virtualbox/private_key`



## 仮想マシンを作り直した場合

```
cd %USERPROFILE%\.ssh
rm known_hosts

knife zero bootstrap 192.168.100.10 -U vagrant -i ../.vagrant/machines/default/virtualbox/private_key --sudo --bootstrap-proxy http://10.0.2.2:3128 --bootstrap-no-proxy 127.0.0.1

knife node -c conf.rb run_list add ubuntu-bionic 'recipe[pkg_install]'
knife node -c conf.rb run_list add ubuntu-bionic 'recipe[add_user]'
knife node -c conf.rb run_list add ubuntu-bionic 'recipe[install_rbenv]'
knife node -c conf.rb run_list add ubuntu-bionic 'recipe[setup_mastodon]'
knife node -c conf.rb run_list add ubuntu-bionic 'recipe[setup_nginx]'
knife node -c conf.rb run_list add ubuntu-bionic 'recipe[setup_mastodon_service]'

knife zero -c conf.rb converge 'name:ubuntu-bionic' -U vagrant --sudo -i ../.vagrant/machines/default/virtualbox/private_key
```
