#
# Cookbook:: setup_nginx
# Recipe:: default
#
# Copyright:: 2019, The Authors, All Rights Reserved.
server_data = data_bag_item('server', 'mastodon')

fqdn = server_data['federation']['local_domain']

service "nginx" do
    action      [:enable]
    supports    :reload => true
end

template "/etc/nginx/sites-available/mastodon" do
    source      "nginx.conf"
    mode        "0644"
    owner       "root"
    group       "root"
    variables   ({
        :fqdn => fqdn
    })
    notifies    :reload, 'service[nginx]'
end

link "/etc/nginx/sites-enabled/default" do
    action      :delete
    only_if     "test -L /etc/nginx/sites-enabled/default"
end

link "/etc/nginx/sites-enabled/mastodon" do
    to          "/etc/nginx/sites-available/mastodon"
    mode        "0644"
    owner       "root"
    group       "root"
end
