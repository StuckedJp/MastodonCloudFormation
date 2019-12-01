#
# Cookbook:: add_user
# Recipe:: default
#
# Copyright:: 2019, The Authors, All Rights Reserved.

user_data = data_bag_item('user', 'mastodon')

group 'mastodon' do
    action  :create
end

user 'mastodon' do
    gid         'mastodon'
    home        user_data['home']
    shell       user_data['shell']
    action      :create
end

directory user_data['home'] do
    owner   'mastodon'
    group   'mastodon'
    mode    0755
    not_if { File.exists? user_data['home'] }
end
