#
# Cookbook:: setup_timesyncd
# Recipe:: default
#
# Copyright:: 2019, Sakai Takao, All Rights Reserved.

ntp_server = node['server']['time']['host']

service "systemd-timesyncd" do
    action      [:enable]
    restart_command 'systemctl restart systemd-timesyncd.service'
end

template "/etc/systemd/timesyncd.conf" do
    source      "timesyncd.conf"
    mode        "0644"
    owner       "root"
    group       "root"
    variables   ({
        :ntp_server => ntp_server
    })
    notifies    :restart, 'service[systemd-timesyncd]'
end
