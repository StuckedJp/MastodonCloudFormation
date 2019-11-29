#
# Cookbook:: setup_mastodon
# Recipe:: default
#
# Copyright:: 2019, The Authors, All Rights Reserved.

user_data = data_bag_item('user', 'mastodon')
server_data = data_bag_item('server', 'mastodon')

fqdn = server_data['federation']['local_domain']
tag = server_data['source']['tag']

user = 'mastodon'
group = 'mastodon'
home = user_data['home']

execute "download_mastodon" do
    user        "root"
    command <<-EOL
        sudo -i -u #{user} git clone https://github.com/tootsuite/mastodon.git #{home}/#{fqdn}
    EOL
    not_if { File.exists? "#{home}/#{fqdn}" }
    action :run
end

execute "checkout_mastodon" do
    user        "root"
    command <<-EOL
        sudo -i -u #{user} bash -c "cd #{home}/#{fqdn} && git checkout #{tag}"
    EOL
    action :run
end

execute "build_mastodon" do
    user        "root"
    command <<-EOL
        sudo -i -u #{user} git config --global http.proxy http://10.0.2.2:3128/
        sudo -i -u #{user} git config --global https.proxy http://10.0.2.2:3128/
        sudo -i -u #{user} git config --global url."https://".insteadOf git://
        sudo -i -u #{user} bash -c "cd #{home}/#{fqdn} && bundle install -j4 --deployment --without development test"
        sudo -i -u #{user} bash -c "cd #{home}/#{fqdn} && yarn install --pure-lockfile"
    EOL
    action :run
end

template "#{home}/#{fqdn}/.env.production" do
    source      "env.production.erb"
    mode        "0644"
    owner       user
    group       group
    variables   ({:server_data => server_data})
end

execute "init_database" do
    user        "root"
    command <<-EOL
        sudo -i -u #{user} bash -c "cd #{home}/#{fqdn} && RAILS_ENV=production SAFETY_ASSURED=1 bundle exec rails db:setup"
    EOL
    action :run
end

execute "precompile" do
    user        "root"
    command <<-EOL
        sudo -i -u #{user} bash -c "cd #{home}/#{fqdn} && RAILS_ENV=production bundle exec rails assets:precompile"
    EOL
    action :run
end
