#
# Cookbook:: pkg_install
# Recipe:: default
#
# Copyright:: 2019, Sakai Takao, All Rights Reserved.

# curl
%w{
    curl
}.each do |pkg|
    package pkg do
        action [ :install ]
    end
end


# Node.js
execute "add_node_js_repo" do
    user "root"
    command "curl -sL https://deb.nodesource.com/setup_8.x | bash -"
    action :run
end


# Yarn
execute "add_yarn_repo" do
    user "root"
    command <<-EOM
        curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
        echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
    EOM
    action :run
end


# install
%w{
    imagemagick 
    ffmpeg 
    libpq-dev
    libxml2-dev
    libxslt1-dev
    file 
    git-core 
    g++
    libprotobuf-dev 
    protobuf-compiler 
    pkg-config
    nodejs
    gcc 
    autoconf 
    bison 
    build-essential 
    libssl-dev 
    libyaml-dev 
    libreadline6-dev
    zlib1g-dev 
    libncurses5-dev 
    libffi-dev
    libgdbm5 
    libgdbm-dev
    nginx
    redis-server 
    redis-tools 
    postgresql 
    postgresql-contrib
    certbot 
    python-certbot-nginx
    yarn
    libidn11-dev 
    libicu-dev 
    libjemalloc-dev    
}.each do |pkg|
    package pkg do
        action [ :install ]
    end
end
