#
# Cookbook:: install_rbenv
# Recipe:: default
#
# Copyright:: 2019, Sakai Takao, All Rights Reserved.

user_data = node['user']
ruby_version = '2.7.2'
user = 'mastodon'
group = 'mastodon'
home = user_data['home']


execute "install_rbenv" do
    user        "root"
    command <<-EOL
        sudo -u #{user} git clone https://github.com/rbenv/rbenv.git #{home}/.rbenv
        sudo -u #{user} bash -c "cd #{home}/.rbenv && src/configure && make -C src"
    EOL
    not_if { File.exists? "#{home}/.rbenv" }
    action :run
end

cookbook_file "#{home}/.bash_profile" do
    source      "bash_profile"
    user        user
    group       group
    mode        '0644'
end

link "#{home}/.bashrc" do
    to          "#{home}/.bash_profile"
    user        user
    group       group
end

execute "install_ruby_build" do
    user        "root"
    command <<-EOL
        sudo -u #{user} git clone https://github.com/rbenv/ruby-build.git #{home}/.rbenv/plugins/ruby-build
    EOL
    not_if { File.exists? "#{home}/.rbenv/plugins/ruby-build" }
    action :run
end

execute "install_ruby" do
    user        "root"
    command <<-EOL
        sudo -i -u #{user} RUBY_CONFIGURE_OPTS=--with-jemalloc rbenv install #{ruby_version}
        sudo -i -u #{user} rbenv global #{ruby_version}
    EOL
    not_if { File.exists? "#{home}/.rbenv/versions/#{ruby_version}" }
    action :run
end

execute "gem_update" do
    user        "root"
    command <<-EOL
        sudo -i -u #{user} gem update --system
    EOL
    action :run
end
