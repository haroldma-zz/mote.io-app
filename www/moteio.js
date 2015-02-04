var 
  thisApp = thisApp || false,
  io = io || null,
  localStorage = localStorage || null,
  console = console || null,
  navigator = navigator || null,
  $ = $ || null,
  device = device,
  window = window || null,
  gaPlugin,
  gaSuccessHandler = function() {
  },
  gaErrorHandler = function() {
  },
  gaTrackEvent = function(action, label, value, int) {
    if(typeof window.plugins !== "undefined") {
      gaPlugin.trackEvent(function(){
        console.log('GA Success');
      }, function(){
        console.log('GA Error');
      }, action, label, value, int);
    }
  };

window.onerror = function(error) {
  gaTrackEvent("window", "error", "error", 1);
};

var App = function () {

  "use strict";

  var self = this;

  self.channel = null;
  self.pubnub = null;
  self.channel_name = null;

  self.lastNotify = {};
  self.config = {};

  self.set = function(key, data) {
    // Put the object into storage
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  }
  self.get = function(key) {
    // Retrieve the object from storage
    var retrievedObject = localStorage.getItem(key);
    if(typeof retrievedObject !== "undefined") {
      return JSON.parse(retrievedObject);
    } else {
      return false;
    }
  }

  self.populateHash = function (given, fallback) {
    if(typeof given !== "undefined" && given) {
      return given;
    }
    return fallback;
  }

  self.renderRemote = function(res) {

    if(typeof res == "undefined" || !res) {
      alert('Connected to site but window.moteioConfig is not defined on web page.', null, 'Developer Error', 'OK');
    } else if(typeof res.app_name == "undefined" || !res.app_name) {
      alert('Please supply an app name in the moteioConfig.', null, 'Developer Error', 'OK')
    }

    self.config = res;

    var
      button_id = 0,
      wrapper = null,
      button_size = 0,
      element = null,
      buttons = null;

    $('#remote-render').html('');

    var id = 0;

    for(var key in self.config.blocks) {

      var type = self.config.blocks[key].type,
        params = self.config.blocks[key];

      params._id = id;
      id++;

      type = params.type;

      if(type == "notify") {

        var wrapper = $('<div class="block"></div>'),
          notify = $('<div class="notify"></div>'),
          text = null;

        $('#remote-render').append(wrapper.append(notify));

        if(typeof params.share !== "undefined" && params.share) {
          wrapper.append('<div class="block share"><div class="buttons"><span class="icon-facebook facebook moteio-button ui-btn-up-a"></span><span class="moteio-button ui-btn-up-a icon-twitter twitter"></span></div></div>');
        }

        $('.twitter, .facebook').bind('vclick', function(){

          console.log('lastnotify is')
          console.log(self.lastNotify)

          var url = '';
          var text = 'I\'m ' + self.config.action;
          var shoutout = $('.ui-title').text();

          if(typeof self.config.twitter !== "undefined" && self.config.twitter) {
            shoutout = '@' + self.config.twitter;
          }

          if(self.lastNotify.line1) {
            text += ' ' + self.lastNotify.line1;
          }
          if(self.lastNotify.line2) {
            text += ' - ' + self.lastNotify.line2
          }

          if($(this).hasClass('twitter')) {

            text += ' on ' + shoutout;
            text += ' ' + self.lastNotify.permalink;
            text += ' via @getmoteio';

            if(typeof self.lastNotify.line1 == "undefined" || self.lastNotify.line1 == "" || !self.lastNotify.line1) {
              text = 'I\'m controlling ' + shoutout + ' with @getmoteio';
            }

            url = 'http://www.twitter.com/share?text=' + encodeURIComponent(text);

            gaTrackEvent("share", "twitter-try", text, 1);

            window.open(url, '_blank');

          } else {

            text += ' on ' + $('.ui-title').text() + ' with Mote.io http://mote.io';

            if(typeof self.lastNotify.line1 == "undefined" || self.lastNotify.line1 == "" || !self.lastNotify.line1) {
              text = 'I\'m controlling ' + $('.ui-title').text();
            }

            var title = 'I\'m ' + self.config.action + ' ' + $('.ui-title').text();
            if(self.lastNotify.line1) {
              title = self.lastNotify.line1;
            }
            if(self.lastNotify.line2) {
              title += ' - ' + self.lastNotify.line2
            }

            var thumb = 'https://mote.io/images/144-2x.png';
            if(self.lastNotify.image) {
              thumb = self.lastNotify.image;
            }

            var params = {
              method: 'feed',
              name: title,
              link: self.lastNotify.permalink,
              picture: thumb,
              caption: text,
              description: 'Remote control your favorite sites like ' + $('.ui-title').text() + ' with Mote.io'
            };

            gaTrackEvent("share", "facebook-try", title, 1);

            FB.ui(params, function(obj) {
              gaTrackEvent("share", "facebook-success", title, 1);
            });

          }

        });

      }

      if(type == "buttons") {

        var container = $("<div class='buttons'></div>");

        var i = 0;
        $.each(params.data, function(index, button){

          var data = {
            block_id: params._id,
            _id: i,
            hash: self.populateHash(button.hash, params._id + '_' + i)
          }

          var data = self.populateHash(params.hash, data);

          element = $('<span id="moteio-button-' + data.hash + '" class="moteio-button ui-btn-up-a icon-' + button.icon + '" /></span>')
            .bind('vclick', function (e) {

              navigator.notification.vibrate(150);

              e.stopPropagation();

              data.press = true;

              self.pubnub.publish({
                channel : self.channel_name,
                message : {
                  type: 'input',
                  data: data
                }
              });

            });

            container.append(element);
            i++;
        });

        $('#remote-render').append($('<div class="block"></div>').append(container));
      }

      if(type == "select") {

        var select_html = $('<select class="render-select"></select>');

        if(typeof params.title !== "undefined") {
          select_html.append($('<option>' + params.title + '</option>'));
        }

        for(var option in params.data){
          var option_html = $('<option value="' + option + '" data-paramid="' + params._id + '">' + params.data[option].text + '</option>');
          if(typeof params.data[option].optgroup !== "undefined") {
            if(select_html.find('optgroup[label=' + params.data[option].optgroup + ']').html() == null){
              select_html.append('<optgroup label="' + params.data[option].optgroup + '"></optgroup>')
              select_html.find('optgroup[label=' + params.data[option].optgroup + ']').append(option_html);
            } else {
              select_html.find('optgroup[label=' + params.data[option].optgroup + ']').append(option_html);
            }
          } else {
            select_html.append(option_html);
          }
        }

        select_html.bind('change', function(e) {

          var option_data = $(this).find(":selected").data();

          var data = {
            block_id: option_data.paramid,
            _id: $(this).val(),
            hash: option_data.paramid + '_' + $(this).val()
          }

          self.pubnub.publish({
            channel : self.channel_name,
            message : {
              type: 'select',
              data: data
            }
          });

        });

        $('#remote-render').append($('<div class="block"></div>').append(select_html));

        $(".render-select").selectmenu();

      }

      if(type == "search") {

        var search_html = $('<form id="remote-search-form" class="block" data-enhance="false"><label for="search-basic" style="display: none">Search Input:</label><input type="search" class="render-search" name="remote-search" id="remote-search" value=""></form>');

        var data = {
          block_id: params._id,
          hash: params._id
        }

        search_html.bind('submit', function(e) {

          data.query =  $("#remote-search").val();

          self.pubnub.publish({
            channel : self.channel_name,
            message : {
              type: 'search',
              data: data
            }
          });

          return false;

        });

        $('#remote-render').append(search_html);

        $('.render-search').textinput();

      }

    }

    buttons = $('.moteio-button');

    $.mobile.changePage($('#remote'));
    $('.ui-title').text(res.app_name);

  };

  self.listen = function (channel_name) {

    self.channel_name = channel_name;

    if(channel_name) {

      self.pubnub.subscribe({
        channel: self.channel_name,
        connect: function() {

          gaTrackEvent("pubnub", "connection", "connect", 1);

          self.pubnub.publish({
            channel : self.channel_name,
            message : {
              type: 'get-config'
            }
          });

        },
        disconnect: function() {

          gaTrackEvent("pubnub", "connection", "disconnect", 1);
          self.logout();

        },
        reconnect: function() {

          gaTrackEvent("pubnub", "connection", "reconnect", 1);

          self.pubnub.publish({
            channel : self.channel_name,
            message : {
              type: 'get-config'
            }
          });

        },
        message: function( message) {

          gaTrackEvent("pubnub", "message", message.type, 1);

          var data = null;
          if(message.data !== "undefined") {
            data = message.data;
          }

          if(message.type == 'update-config') {

            self.renderRemote(data);

            self.pubnub.publish({
              channel : self.channel_name,
              message : {
                type: 'got-config'
              }
            });

          }

          if(message.type == 'notify') {

            var now_playing = $('.notify');
            now_playing.empty();

            if (typeof data.image !== "undefined") {
              $('.notify').addClass('with-thumb');
              now_playing.append('<img src="' + data.image + '" class="thumb" />');
            } else {
              $('.notify').removeClass('with-thumb');
            }
            if (typeof data.line1 !== "undefined") {
              now_playing.append('<div class="line line-1">' + data.line1 + '</p>');
            }
            if (typeof data.line2 !== "undefined") {
              now_playing.append('<div class="line line-2">' + data.line2 + '</p>');
            }

            self.lastNotify.line1 = data.line1;
            self.lastNotify.line2 = data.line2;
            self.lastNotify.image = data.image;
            self.lastNotify.permalink = data.permalink;
            self.lastNotify.url = data.url;

          }

          if(message.type == 'update-button') {

            if(data.icon) {
              $('#moteio-button-' + data.hash).removeClass().addClass('moteio-button ui-btn-up-a icon-' + data.icon);
            }

            if(data.color) {
              $('#moteio-button-' + data.hash).css({
                'color': data.color
              });
            }

          }

        }

      });

      $('.go-home').bind('vclick', function(){

        gaTrackEvent("pubnub", "publist", "go-home", 1);

        navigator.notification.vibrate(150);

        self.pubnub.publish({
          channel : self.channel_name,
          message : {
            type: 'go-home'
          }
        });

      });

    }

  };

  self.logout = function () {
    self.pubnub.unsubscribe({ channel : self.channel_name })
    $('#remote-render').html('');
    $.mobile.changePage($('#login'));
  }

  self.offline = function() {
  }

  self.pause = function() {
  }

  self.resume = function() {
    self.listen(self.channel_name);
  }

  self.init = function () {

    if(typeof window.plugins !== "undefined") {
      gaPlugin = window.plugins.gaPlugin;
      gaPlugin.init(gaSuccessHandler, gaErrorHandler, "UA-40127738-2", 10);
    }

    gaTrackEvent("init", "model", device.model, 1);
    gaTrackEvent("init", "platform", device.platform, 1);
    gaTrackEvent("init", "version", device.version, 1);

    self.pubnub = PUBNUB.init({
      publish_key: 'pub-2cc75d12-3c70-4599-babc-3e1d27fd1ad4',
      subscribe_key: 'sub-cfb3b894-0a2a-11e0-a510-1d92d9e0ffba',
      origin        : 'pubsub.pubnub.com',
      ssl           : true,
      restore       : true
    });

    if(navigator.connection.type !== Connection.WIFI && navigator.connection.type !== Connection.ETHERNET) {
      // this should show up on /login and update on connection change
      gaTrackEvent("connection", "type", navigator.connection.type, 1);
    };

    var data = null;

    $("#login-form").submit(function (e) {

      $('#status-message').html('<p>Logging In...</p>');
      $.mobile.changePage($('#status'));

      var data = $(this).serializeArray();
      if(data[0].value == "staging@mote.io") {
        gaTrackEvent("login", "staging", "try", 1);
        self.remote_location = 'https://moteiostaging-9163.onmodulus.net';
      } else if(data[0].value == "ian+local@meetjennings.com") {
        gaTrackEvent("login", "localhost", "try", 1);
        self.remote_location = 'https://localhost:3000';
      } else {
        gaTrackEvent("login", "production", "try", 1);
        self.remote_location = 'https://mote.io:443';
      }

      $.ajaxSetup({
        statusCode: {
          401: function(){
            // Redirec the to the login page.
            gaTrackEvent("login", "try", "401", 1);
            alert('Error authorizing.', null, 'Error!', 'OK');
            $.mobile.changePage($('#login'));
          }
        }
      });

      $.ajax({
        type: 'post',
        url: self.remote_location + '/post/login',
        data: {
          'username': data[0].value,
          'password': data[1].value,
          'remember-me': data[2].value
        },
        dataType: 'jsonp',
        timeout: 8000,
        success: function(response) {

          if(response.valid) {

            gaTrackEvent("login", "try", "success", 1);

            if(data[2].value == "1") {
              self.set('login', data);
              gaTrackEvent("login", "remember-me", "true", 1);
            } else {
              self.set('login', null)
              gaTrackEvent("login", "remember-me", "false", 1);
              $('#password').val('');
            }

            self.listen(response.channel_name);

            $('#status-message').html('<p>Syncing...</p><p>Visit <a>http://mote.io/start</a> on your computer to continue.</p>');
            $.mobile.changePage($('#status'));

          } else {

            gaTrackEvent("login", "try", "fail", 1);

            $.mobile.changePage($('#login'));
            alert(response.reason, null, 'Error!', 'OK');
          }

        },
        error: function(xhr, status, err) {
          gaTrackEvent("login", "try", "server-error", 1);
          alert('There was a problem logging you in or the server timed out. Check your username and password.', null, 'Error', 'OK');
          $.mobile.changePage($('#login'));
        }
      });

      return false;

    });

    $('.logout').bind('vclick', function(){
      gaTrackEvent("logout", "try", "success", 1);
      self.logout();
      $.mobile.changePage($('#login'));
    });

    $('.sign-up').bind('vclick', function(){

      gaTrackEvent("signup", "try", "try", 1);

      var ref = window.open('https://mote.io/register', '_blank');
      ref.addEventListener('loadstart', function(event) {
        if(event.url == "https://mote.io/start") {
          ref.close();
          alert('All signed up! Now log in.', null, 'Hurray!', 'OK');
          gaTrackEvent("signup", "try", "success", 1);
        }
      });

    });

    $('.forgot-password').bind('vclick', function(){
      gaTrackEvent("login", "forgot-password", "try", 1);
      var ref = window.open('https://mote.io/reset', '_blank');
    });

    if(self.get('login')) {

      var data = self.get('login')

      $('#username').val(data[0].value);
      $('#password').val(data[1].value);
      $('#remember-me').val('1').slider('refresh');
      $("#login-form").submit();

    } else {
      $.mobile.changePage($('#login'));
    }

    navigator.splashscreen.hide();

  };

};
