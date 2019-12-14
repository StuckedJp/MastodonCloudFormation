#
# Cookbook:: install_mastodon
# Recipe:: default
#
# Copyright:: 2019, Sakai Takao, All Rights Reserved.

user_data = node['user']
server_data = node['server']

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

execute "generate_secret" do
    user        "root"
    command <<-EOL
        echo "# SECRETS" >> "#{home}/#{fqdn}/.env.production"

        SECRET_KEY_BASE=$(sudo -i -u #{user} bash -c "cd #{home}/#{fqdn} && RAILS_ENV=production bundle exec rake secret")
        echo "SECRET_KEY_BASE=$SECRET_KEY_BASE" >> "#{home}/#{fqdn}/.env.production"

        OTP_SECRET=$(sudo -i -u #{user} bash -c "cd #{home}/#{fqdn} && RAILS_ENV=production bundle exec rake secret")
        echo "OTP_SECRET=$OTP_SECRET" >> "#{home}/#{fqdn}/.env.production"

        sudo -i -u #{user} bash -c "cd #{home}/#{fqdn} && RAILS_ENV=production bundle exec rake mastodon:webpush:generate_vapid_key >> \"#{home}/#{fqdn}/.env.production\""

        echo "# SECRETS" >> "#{home}/#{fqdn}/.env.production"
    EOL
    action :run
    not_if  "grep \"# SECRETS\" #{home}/#{fqdn}/.env.production"
end

template "/tmp/drop_database.sql" do
    source      "drop_database.sql.erb"
    mode        "0644"
    owner       user
    group       group
    variables   ({:db_name => server_data['database']['db_name']})
end

execute "clear_database" do
    user        "root"
    command <<-EOL
        sudo -u postgres psql < /tmp/drop_database.sql
    EOL
    action          :run
    ignore_failure  true
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
