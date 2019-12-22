#
# Cookbook:: setup_mastodon_service
# Recipe:: default
#
# Copyright:: 2019, Sakai Takao, All Rights Reserved.

fqdn = node['server']['federation']['local_domain']

template "/etc/systemd/system/mastodon-web.service" do
    source      "mastodon-web.service.erb"
    mode        "0644"
    owner       "root"
    group       "root"
    variables   ({
        :fqdn => fqdn
    })
end

service "mastodon-web" do
    action      [:enable, :start]
end


template "/etc/systemd/system/mastodon-streaming.service" do
    source      "mastodon-streaming.service.erb"
    mode        "0644"
    owner       "root"
    group       "root"
    variables   ({
        :fqdn => fqdn
    })
end

service "mastodon-streaming" do
    action      [:enable, :start]
end


template "/etc/systemd/system/mastodon-sidekiq.service" do
    source      "mastodon-sidekiq.service.erb"
    mode        "0644"
    owner       "root"
    group       "root"
    variables   ({
        :fqdn => fqdn
    })
end

service "mastodon-sidekiq" do
    action      [:enable, :start]
end
